"use strict";

geotab.addin.heatmap = function() {
    // ---- VARIABLER ----
    var v, // api (Geotab API-objektet)
        h, // map (Leaflet-kartobjektet)
        m, // heatLayer (Själva värmekartans lager)
        p, // exceptionTypes (Dropdown för regler)
        y, // vehicles (Dropdown för fordon)
        E, // from (Startdatum)
        w, // to (Slutdatum)
        i, // showHeatMap (Knappen)
        l, // error (Div för felmeddelanden)
        r, // message (Div för info-meddelanden)
        c, // loading (Laddnings-spinnern)
        D, // Antal valda fordon
        t, // startTime (För att mäta hur lång tid hämtningen tar)
        I = 50000; // Resultatgräns (resultsLimit) per anrop

    // Hjälpfunktion: Uppdaterar felmeddelande-UI
    var b = function(e) { l.innerHTML = e; };
    
    // Hjälpfunktion: Uppdaterar informationsmeddelande-UI
    var B = function(e) { r.innerHTML = e; };

    // Hjälpfunktion: Kontrollerar om en array är helt tom
    function x(e) {
        if (!e || 0 === e.length) return !0;
        for (var t = 0; t < e.length; t++) {
            if (0 < e[t].length) return !1;
        }
        return !0;
    }

    // Hjälpfunktion: Formaterar nummer med tusentalsavgränsare
    function S(e) {
        return e.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
    }

    // Hjälpfunktion: Räknar ut hur många sekunder anropet tog
    function N() {
        return Math.round((new Date() - t) / 1000);
    }

    // Hjälpfunktion: Togglar UI för att visa att systemet laddar
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

    // HUVUDFUNKTION: Rendera heatmappen baserat på val
    var d = function() {
        // Rensa existerande heatlayer om den finns
        if (typeof m !== "undefined") {
            h.removeLayer(m);
        }
        
        // Skapa en ny Leaflet HeatLayer med gradientfärger
        m = L.heatLayer({
            radius: { value: 24, absolute: !1 },
            opacity: 0.7,
            gradient: { 0.45: "rgb(0,0,255)", 0.55: "rgb(0,255,255)", 0.65: "rgb(0,255,0)", 0.95: "yellow", 1: "rgb(255,0,0)" }
        }).addTo(h);

        // Räkna antal valda fordon
        D = 0;
        for (var e = 0; e < y.options.length; e++) {
            if (y.options[e].selected) D++;
        }

        // Om fordon är valda, bestäm vilken typ av data som ska hämtas
        if (D !== 0) {
            t = new Date(); // Starta timer
            if (p.disabled === true) {
                n(); // Hämta platshistorik
            } else {
                o(); // Hämta undantag/regelbrott
            }
        } else {
            b("Please select at least one vehicle from the list and try again.");
        }
    };

    // HÄMTA DATA: Platshistorik (Location History)
    var n = function() {
        var t = [];
        var options = y.options;
        for (var idx = 0; idx < options.length; idx++) {
            if (options[idx].selected) t.push(options[idx].value || options[idx].text);
        }

        var fromDate = E.value;
        var toDate = w.value;

        if (b(""), B(""), null !== t && "" !== fromDate && "" !== toDate) {
            T(!0); // Visa laddningsspinner
            var fromISO = new Date(fromDate).toISOString();
            var toISO = new Date(toDate).toISOString();
            var calls = [];

            // Bygg ihop ett multiCall för varje valt fordon
            for (var u = 0; u < t.length; u++) {
                calls.push(["Get", {
                    typeName: "LogRecord",
                    resultsLimit: I,
                    search: { deviceSearch: { id: t[u] }, fromDate: fromISO, toDate: toISO }
                }]);
            }

            v.multiCall(calls, function(results) {
                if (x(results)) {
                    b("No data to display");
                    T(!1);
                    return;
                }
                
                var heatData = [], boundsData = [], totalRecords = 0, exceededCount = 0;
                
                for (var l = 0; l < results.length; l++) {
                    var logs = results[l];
                    for (var c = 0; c < logs.length; c++) {
                        // Sålla bort ogiltiga koordinater (0,0)
                        if (0 !== logs[c].latitude || 0 !== logs[c].longitude) {
                            heatData.push({ lat: logs[c].latitude, lon: logs[c].longitude, value: 1 });
                            boundsData.push(new L.LatLng(logs[c].latitude, logs[c].longitude));
                            totalRecords++;
                        }
                    }
                    if (logs.length >= I) exceededCount++;
                }

                if (heatData.length > 0) {
                    h.fitBounds(boundsData); // Centrera kartan
                    m.setLatLngs(heatData);  // Applicera data på heatmappen
                    B("Displaying " + S(totalRecords) + " combined log records for the " + S(D) + " selected vehicles. [" + N() + " sec]");
                    
                    if (exceededCount > 0) {
                        b("Note: Not all results are displayed because the result limit of " + S(I) + " was exceeded for " + S(exceededCount) + " of the selected vehicles.");
                    }
                } else {
                    b("No data to display");
                }
                T(!1);
            }, function(err) {
                alert(err);
                T(!1);
            });
        }
    };

    // HÄMTA DATA: Regelbrott/Undantag (Exception History) - OPTIMERAD VERSION
    var o = function() {
        var ruleId = p.options[p.selectedIndex].value;
        var ruleName = p.options[p.selectedIndex].text;
        var vehicles = [];
        var options = y.options;
        
        // Hämta valda fordon
        for (var a = 0; a < options.length; a++) {
            if (options[a].selected) vehicles.push(options[a].value || options[a].text);
        }

        var fromDate = E.value;
        var toDate = w.value;

        if (b(""), B(""), null !== vehicles && null !== ruleId && "" !== fromDate && "" !== toDate) {
            T(!0); // Visa laddningsspinner
            var fromISO = new Date(fromDate).toISOString();
            var toISO = new Date(toDate).toISOString();
            var exceptionCalls = [];

            // Steg 1: Bygg anrop för att hämta ExceptionEvents för valda fordon och regel
            for (var s = 0; s < vehicles.length; s++) {
                exceptionCalls.push(["Get", {
                    typeName: "ExceptionEvent",
                    resultsLimit: I,
                    search: { deviceSearch: { id: vehicles[s] }, ruleSearch: { id: ruleId }, fromDate: fromISO, toDate: toISO }
                }]);
            }

            // Skicka iväg alla exception-anrop
            v.multiCall(exceptionCalls, function(exceptionResults) {
                if (x(exceptionResults)) {
                    b("No data to display");
                    T(!1);
                    return;
                }

                var logCalls = [];
                var vehiclesWithExceptions = [];
                var exceptionsByDevice = {};
                var totalExceptions = 0;
                
                // Steg 2: Analysera vilka fordon som faktiskt hade regelbrott
                for (var n = 0; n < exceptionResults.length; n++) {
                    var exceptions = exceptionResults[n];
                    
                    if (exceptions && exceptions.length > 0) {
                        var deviceId = vehicles[n]; // Matchar index från våra anrop
                        vehiclesWithExceptions.push(deviceId);
                        exceptionsByDevice[deviceId] = exceptions;
                        totalExceptions += exceptions.length;

                        // Bygg anrop för att hämta LogRecords för ENBART de fordon som hade regelbrott
                        logCalls.push(["Get", {
                            typeName: "LogRecord",
                            resultsLimit: I,
                            search: { deviceSearch: { id: deviceId }, fromDate: fromISO, toDate: toISO }
                        }]);
                    }
                }

                // Om inga fordon hade några regelbrott av denna typ
                if (logCalls.length === 0) {
                    b("No data to display");
                    T(!1);
                    return;
                }

                // Steg 3: Hämta LogRecords för hela tidsperioden (max 1 anrop per fordon)
                v.multiCall(logCalls, function(logResults) {
                    if (x(logResults)) {
                        b("No data to display");
                        T(!1);
                        return;
                    }

                    var heatData = [];
                    var boundsData = [];
                    var totalRecords = 0;
                    var exceededLogs = 0;
                    
                    // Steg 4: Filtrera loggarna lokalt i webbläsaren
                    for (var i = 0; i < logResults.length; i++) {
                        var logs = logResults[i];
                        var deviceId = vehiclesWithExceptions[i];
                        var deviceExceptions = exceptionsByDevice[deviceId];

                        if (logs.length >= I) exceededLogs++;

                        for (var c = 0; c < logs.length; c++) {
                            var log = logs[c];
                            
                            // Sålla bort ogiltiga koordinater
                            if (0 !== log.latitude || 0 !== log.longitude) {
                                // Loggens tidsstämpel
                                var logTime = new Date(log.dateTime).getTime(); 

                                // Kontrollera om loggens tid faller inom något av fordonets regelbrott
                                var isWithinException = false;
                                for (var e = 0; e < deviceExceptions.length; e++) {
                                    var ex = deviceExceptions[e];
                                    var start = new Date(ex.activeFrom).getTime();
                                    var end = new Date(ex.activeTo).getTime();

                                    if (logTime >= start && logTime <= end) {
                                        isWithinException = true;
                                        break; // Vi hittade en matchning, ingen idé att leta vidare
                                    }
                                }

                                // Om loggen skedde under ett regelbrott, spara den för kartan!
                                if (isWithinException) {
                                    heatData.push({ lat: log.latitude, lon: log.longitude, value: 1 });
                                    boundsData.push(new L.LatLng(log.latitude, log.longitude));
                                    totalRecords++;
                                }
                            }
                        }
                    }

                    // Steg 5: Rita ut på kartan
                    if (heatData.length > 0) {
                        h.fitBounds(boundsData);
                        m.setLatLngs(heatData);
                        B("Displaying " + S(totalRecords) + " combined log records associated with the " + S(totalExceptions) + " '" + ruleName + "' rule exceptions found for the " + S(D) + " selected vehicles. [" + N() + " sec]");
                        
                        if (exceededLogs > 0) {
                            b("Note: The result limit of " + S(I) + " logs was exceeded for some vehicles. Try selecting a shorter date range if you feel data is missing.");
                        }
                        T(!1);
                    } else {
                        b("No data to display");
                    }

                }, function(err) {
                    alert("Error fetching logs: " + err);
                    T(!1);
                });

            }, function(err) {
                alert("Error fetching exceptions: " + err);
                T(!1);
            });
        }
    };

    // UI-SETUP: Kopplar HTML-elementen till koden och bygger kartan
    var a = function(coords) {
        // Skapa Leaflet-kartan baserat på koordinater
        h = new L.Map("heatmap-map", {
            center: new L.LatLng(coords.latitude, coords.longitude),
            zoom: 13
        });
        
        // Lägg till kartgrafiken (Tiles) från OpenStreetMap
        L.tileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            subdomains: ["a", "b", "c"]
        }).addTo(h);

        // Hämta UI-element från HTML-filen
        p = document.getElementById("exceptionTypes");
        y = document.getElementById("vehicles");
        E = document.getElementById("from");
        w = document.getElementById("to");
        i = document.getElementById("showHeatMap");
        l = document.getElementById("error");
        r = document.getElementById("message");
        c = document.getElementById("loading");

        // Sätt defaultvärden på från/till-datum (Idag 00:00 - 23:59)
        var now = new Date(), day = now.getDate(), month = now.getMonth() + 1, year = now.getFullYear();
        if (day < 10) day = "0" + day;
        if (month < 10) month = "0" + month;
        E.value = year + "-" + month + "-" + day + "T00:00";
        w.value = year + "-" + month + "-" + day + "T23:59";

        // Lägg till event-listeners på knapparna
        document.getElementById("visualizeByLocationHistory").addEventListener("click", function() { p.disabled = !0; });
        document.getElementById("visualizeByExceptionHistory").addEventListener("click", function() { p.disabled = !1; });
        document.getElementById("showHeatMap").addEventListener("click", function(e) { e.preventDefault(); d(); });
    };

    // Hjälpfunktion: Sortera listor alfabetiskt
    var u = function(e, t) {
        var nameA = e.name.toLowerCase(), nameB = t.name.toLowerCase();
        return nameA === nameB ? 0 : nameB < nameA ? 1 : -1;
    };

    // ---- GEOTAB ADD-IN LIVSCYKEL ----
    return {
        // Körs en gång när Add-in laddas
        initialize: function(api, state, readyCallback) {
            v = api; // Spara api-objektet

            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    function(position) {
                        a(position.coords); // Starta kartan på användarens nuvarande plats
                        readyCallback();
                    },
                    function(error) { // FIX: Denna funktion fångar upp om användaren nekar plats
                        console.warn("Plats nekad, startar med standardkoordinater.");
                        a({ longitude: 59.3038451, latitude: 18.0037563 });
                        readyCallback();
                    }
                );
            } else {
                a({ longitude: 59.3038451, latitude: 18.0037563 });
                readyCallback();
            }
        },

        // Körs varje gång sidan visas för användaren
        focus: function(api, state) {
            v = api;
            
            // Hämta enheterna (fordonen) och fyll i dropdownen
            v.call("Get", {
                typeName: "Device",
                resultsLimit: 50000,
                search: { fromDate: (new Date()).toISOString(), groups: state.getGroupFilter() }
            }, function(devices) {
                if (devices && devices.length > 0) {
                    devices.sort(u);
                    devices.forEach(function(device) {
                        var option = new Option();
                        option.text = device.name;
                        option.value = device.id;
                        y.add(option);
                    });
                }
            }, b);

            // Hämta reglerna och fyll i dropdownen
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

            // Säkerställ att kartan ritar om sig korrekt när man byter flik i MyGeotab
            setTimeout(function() {
                h.invalidateSize();
            }, 200);
        }
    };
};
