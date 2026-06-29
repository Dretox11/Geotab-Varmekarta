"use strict";

geotab.addin.heatmap = function() {
    // ---- VARIABLER ----
    var v, h, m, p, y, E, w, i, l, r, c, D, t,
        E_LIMIT = 300000;

    var b = function(e) { l.innerHTML = e; };
    var B = function(e) { r.innerHTML = e; };

    function x(e) {
        if (!e || 0 === e.length) return !0;
        for (var t = 0; t < e.length; t++) {
            if (0 < e[t].length) return !1;
        }
        return !0;
    }

    function S(e) {
        return e.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1 ");
    }

    function N() {
        return Math.round((new Date() - t) / 1000);
    }

    var T = function(e) {
        if (e) {
            i.disabled = !0;
            c.style.display = "block";
        } else {
            setTimeout(function() {
                c.style.display = "none";
            }, 600);
            i.disabled = !1;
        }
    };

    // Hjälpfunktion för att portionera API-anrop med SMART HASTIGHET & NEDRÄKNING
    var chunkedMultiCall = function(calls, chunkSize, onComplete, onError) {
        var allResults = [];
        var currentIndex = 0;
        var totalCalls = calls.length;
        var totalChunks = Math.ceil(totalCalls / chunkSize);
        
        // Smart hastighetsberäkning
        var isLargeQuery = totalCalls > 800;
        var delay = isLargeQuery ? 6500 : 50; 

        function doNextChunk() {
            var chunk = calls.slice(currentIndex, currentIndex + chunkSize);
            
            if (chunk.length === 0) {
                if (isLargeQuery) b(""); // Rensa meddelandet när vi är klara
                onComplete(allResults);
                return;
            }

            // Dynamisk uppdatering av UI med nedräkning om det är en stor sökning
            if (isLargeQuery) {
                var currentChunkNum = Math.floor(currentIndex / chunkSize) + 1;
                var chunksLeft = totalChunks - currentChunkNum;
                // Räkna ut sekunder kvar (antalet kvarvarande klumpar * vår paus)
                var secondsLeft = Math.round((chunksLeft * delay) / 1000);
                
                b("Hämtar stora mängder data för att förhindra systemöverbelastning.<br>" +
                  "<strong>Laddar del " + currentChunkNum + " av " + totalChunks + ". Beräknad tid kvar: ca " + secondsLeft + " sekunder.</strong>");
            }

            v.multiCall(chunk, function(chunkResults) {
                allResults = allResults.concat(chunkResults);
                currentIndex += chunkSize;
                
                setTimeout(doNextChunk, delay); 
            }, onError);
        }
        doNextChunk();
    };

    // Starta utritning av kartan
    var d = function() {
        if (typeof m !== "undefined") {
            h.removeLayer(m);
        }
        
        m = L.heatLayer({
            radius: { value: 24, absolute: !1 },
            opacity: 0.7,
            gradient: { 0.45: "rgb(0,0,255)", 0.55: "rgb(0,255,255)", 0.65: "rgb(0,255,0)", 0.95: "yellow", 1: "rgb(255,0,0)" }
        }).addTo(h);

        D = 0;
        for (var e = 0; e < y.options.length; e++) {
            if (y.options[e].selected) D++;
        }

        if (D !== 0) {
            t = new Date();
            fetchExceptionData();
        } else {
            b("Vänligen välj minst ett fordon i listan och försök igen.");
        }
    };

    // Logik för att hämta avvikelser och loggar
    var fetchExceptionData = function() {
        var ruleId = p.options[p.selectedIndex].value;
        var ruleName = p.options[p.selectedIndex].text;
        
        if (!ruleId || ruleId === "") {
            b("Vänligen välj en regel i listan.");
            return;
        }

        var vehicles = [];
        var options = y.options;
        
        for (var a = 0; a < options.length; a++) {
            if (options[a].selected) vehicles.push(options[a].value || options[a].text);
        }

        var fromDate = E.value;
        var toDate = w.value;

        if (b(""), B(""), null !== vehicles && "" !== fromDate && "" !== toDate) {
            T(!0);
            var fromISO = new Date(fromDate).toISOString();
            var toISO = new Date(toDate).toISOString();
            var exceptionCalls = [];

            // Steg 1: Hämta alla regelbrott för valda fordon
            for (var s = 0; s < vehicles.length; s++) {
                exceptionCalls.push(["Get", {
                    typeName: "ExceptionEvent",
                    resultsLimit: 50000, 
                    search: { deviceSearch: { id: vehicles[s] }, ruleSearch: { id: ruleId }, fromDate: fromISO, toDate: toISO }
                }]);
            }

            chunkedMultiCall(exceptionCalls, 100, function(exceptionResults) {
                if (x(exceptionResults)) {
                    b("Inga regelbrott hittades för vald period.");
                    T(!1);
                    return;
                }

                var logCalls = [];
                var totalExceptions = 0;
                
                // Steg 2: Skapa exakta sökfönster för loggarna baserat på när regelbrotten skedde
                for (var n = 0; n < exceptionResults.length; n++) {
                    var exceptions = exceptionResults[n];
                    
                    if (exceptions && exceptions.length > 0) {
                        for (var e = 0; e < exceptions.length; e++) {
                            totalExceptions++;
                            
                            logCalls.push(["Get", {
                                typeName: "LogRecord",
                                resultsLimit: 50000, 
                                search: { 
                                    deviceSearch: { id: exceptions[e].device.id }, 
                                    fromDate: exceptions[e].activeFrom, 
                                    toDate: exceptions[e].activeTo 
                                }
                            }]);
                        }
                    }
                }

                if (logCalls.length === 0) {
                    b("Inga regelbrott hittades.");
                    T(!1);
                    return;
                }

                // Steg 3: Hämta positionerna
                chunkedMultiCall(logCalls, 100, function(logResults) {
                    if (x(logResults)) {
                        b("Ingen positionsdata kunde hämtas för regelbrotten.");
                        T(!1);
                        return;
                    }

                    var heatData = [];
                    var boundsData = [];
                    var totalRecords = 0;
                    
                    for (var i = 0; i < logResults.length; i++) {
                        var logs = logResults[i];

                        for (var c = 0; c < logs.length; c++) {
                            var log = logs[c];
                            
                            if (0 !== log.latitude || 0 !== log.longitude) {
                                heatData.push({ lat: log.latitude, lon: log.longitude, value: 1 });
                                boundsData.push(new L.LatLng(log.latitude, log.longitude));
                                totalRecords++;
                            }
                        }
                    }

                    // Steg 4: Rita ut
                    if (heatData.length > 0) {
                        h.fitBounds(boundsData);
                        m.setLatLngs(heatData);
                        B("Visar " + S(totalRecords) + " datapunkter för " + S(totalExceptions) + " st '" + ruleName + "'-regelbrott. [" + N() + " sek]");
                        T(!1);
                    } else {
                        b("Ingen data att visa på kartan.");
                        T(!1);
                    }

                }, function(err) {
                    alert("Fel vid hämtning av loggar: " + err);
                    T(!1);
                });

            }, function(err) {
                alert("Fel vid hämtning av regelbrott: " + err);
                T(!1);
            });
        }
    };

    var a = function(coords) {
        h = new L.Map("heatmap-map", {
            center: new L.LatLng(coords.latitude, coords.longitude),
            zoom: 13
        });
        
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            subdomains: ["a", "b", "c"]
        }).addTo(h);

        p = document.getElementById("exceptionTypes");
        y = document.getElementById("vehicles");
        E = document.getElementById("from");
        w = document.getElementById("to");
        i = document.getElementById("showHeatMap");
        l = document.getElementById("error");
        r = document.getElementById("message");
        c = document.getElementById("loading");

        var now = new Date(), day = now.getDate(), month = now.getMonth() + 1, year = now.getFullYear();
        if (day < 10) day = "0" + day;
        if (month < 10) month = "0" + month;
        E.value = year + "-" + month + "-" + day + "T00:00";
        w.value = year + "-" + month + "-" + day + "T23:59";

        document.getElementById("showHeatMap").addEventListener("click", function(e) { e.preventDefault(); d(); });
    };

    var u = function(e, t) {
        return e.name.localeCompare(t.name, 'sv', { numeric: true });
    };

    return {
        initialize: function(api, state, readyCallback) {
            v = api; 

            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    function(position) {
                        a(position.coords); 
                        readyCallback();
                    },
                    function(error) { 
                        a({ longitude: 18.0686, latitude: 59.3293 });
                        readyCallback();
                    }
                );
            } else {
                a({ longitude: 18.0686, latitude: 59.3293 });
                readyCallback();
            }
        },

        focus: function(api, state) {
            v = api;
            
            y.options.length = 0; 
            p.options.length = 0;
            
            var defaultRule = new Option("Välj en regel", "");
            defaultRule.disabled = true;
            defaultRule.selected = true;
            p.add(defaultRule);

            var groupFilter = state.getGroupFilter();
            var deviceSearch = { fromDate: (new Date()).toISOString() };
            
            if (groupFilter && groupFilter.length > 0) {
                deviceSearch.groups = [];
                for (var f = 0; f < groupFilter.length; f++) {
                    deviceSearch.groups.push({ id: groupFilter[f].id });
                }
            }

            v.call("Get", {
                typeName: "Device",
                resultsLimit: 50000,
                search: deviceSearch
            }, function(devices) {
                if (devices && devices.length > 0) {
                    devices.sort(u); 
                    devices.forEach(function(device) {
                        var option = new Option();
                        option.text = device.name;
                        option.value = device.id;
                        y.add(option);
                    });
                } else {
                    var emptyOption = new Option("Inga fordon i denna grupp", "");
                    emptyOption.disabled = true;
                    y.add(emptyOption);
                }
            }, b); 

            v.call("Get", {
                typeName: "Rule",
                resultsLimit: 50000
            }, function(rules) {
                if (rules && rules.length > 0) {
                    rules.sort(u); 
                    rules.forEach(function(rule) {
                        var option = new Option();
                        option.text = rule.name;
                        option.value = rule.id;
                        p.add(option);
                    });
                }
            }, b);

            setTimeout(function() {
                h.invalidateSize();
            }, 200);
        }
    };
};
