"use strict";

geotab.addin.heatmap = function() {
    // ---- VARIABLER ----
    var v, h, m, p, y, E, w, i, l, r, c, D, t, cancelBtn,
        E_LIMIT = 300000,
        isCancelled = false; // Vår strömbrytare för att avbryta sökningar

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

    // Visa/dölj Avbryt-knappen och laddningssnurran
    var T = function(e) {
        if (e) {
            isCancelled = false; // Återställ alltid till false vid ny sökning
            i.disabled = !0;
            cancelBtn.style.display = "block"; // Visa Avbryt-knappen
            c.style.display = "block";
        } else {
            setTimeout(function() {
                c.style.display = "none";
            }, 600);
            i.disabled = !1;
            cancelBtn.style.display = "none"; // Dölj Avbryt-knappen
        }
    };

    // Hjälpfunktion för att portionera API-anrop med SMART HASTIGHET & NEDRÄKNING
    var chunkedMultiCall = function(calls, chunkSize, onComplete, onError) {
        var allResults = [];
        var currentIndex = 0;
        var totalCalls = calls.length;
        var totalChunks = Math.ceil(totalCalls / chunkSize);
        
        var isLargeQuery = totalCalls > 800;
        var delay = isLargeQuery ? 6500 : 50; 

        function doNextChunk() {
            // Kolla om användaren har klickat på Avbryt
            if (isCancelled) {
                b("Sökningen avbröts av användaren.");
                T(!1);
                return;
            }

            var chunk = calls.slice(currentIndex, currentIndex + chunkSize);
            
            if (chunk.length === 0) {
                if (isLargeQuery) b(""); 
                onComplete(allResults);
                return;
            }

            if (isLargeQuery) {
                var currentChunkNum = Math.floor(currentIndex / chunkSize) + 1;
                var chunksLeft = totalChunks - currentChunkNum;
                var secondsLeft = Math.round((chunksLeft * delay) / 1000);
                
                b("Hämtar stora mängder data för att förhindra systemöverbelastning.<br>" +
                  "<strong>Laddar del " + currentChunkNum + " av " + totalChunks + ". Beräknad tid kvar: ca " + secondsLeft + " sekunder.</strong>");
            }

            v.multiCall(chunk, function(chunkResults) {
                if (isCancelled) {
                    b("Sökningen avbröts av användaren.");
                    T(!1);
                    return;
                }

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
        var rule
