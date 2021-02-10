// ==UserScript==
// @id liveInventory
// @name IITC Plugin: Live Inventory
// @category Info
// @version 0.0.2
// @namespace	https://github.com/EisFrei/IngressLiveInventory
// @downloadURL	https://github.com/EisFrei/IngressLiveInventory/raw/main/liveInventory.user.js
// @homepageURL	https://github.com/EisFrei/IngressLiveInventory
// @description Show current ingame inventory
// @author EisFrei
// @include		https://intel.ingress.com/*
// @match		https://intel.ingress.com/*
// @grant			none
// ==/UserScript==

function wrapper(plugin_info) {

    // Make sure that window.plugin exists. IITC defines it as a no-op function,
    // and other plugins assume the same.
    if (typeof window.plugin !== "function") window.plugin = function () {};
    const KEY_SETTINGS = "plugin-live-inventory";

    window.plugin.LiveInventory = function () {};

    const thisPlugin = window.plugin.LiveInventory;
    // Name of the IITC build for first-party plugins
    plugin_info.buildName = "LiveInventory";

    // Datetime-derived version of the plugin
    plugin_info.dateTimeVersion = "202102100950";

    // ID/name of the plugin
    plugin_info.pluginId = "liveInventory";

    const translations = {
        BOOSTED_POWER_CUBE: 'Hypercube',
        CAPSULE: 'Capsule',
        DRONE: 'Drone',
        EMITTER_A: 'Resonator',
        EMP_BURSTER: 'Burster',
        EXTRA_SHIELD: 'Aegis Shield',
        FLIP_CARD: 'Virus',
        FORCE_AMP: 'Force Amp',
        HEATSINK: 'Heatsink',
        INTEREST_CAPSULE: 'Quantum Capsule',
        KEY_CAPSULE: 'Key Capsule',
        KINETIC_CAPSULE: 'Kinetic Capsule',
        LINK_AMPLIFIER: 'Link Amp',
        MEDIA: 'Media',
        MULTIHACK: 'Multi-Hack',
        PLAYER_POWERUP: 'Apex',
        PORTAL_LINK_KEY: 'Key',
        PORTAL_POWERUP: 'Fracker',
        POWER_CUBE: 'Power Cube',
        RES_SHIELD: 'Shield',
        TRANSMUTER_ATTACK: 'ITO -',
        TRANSMUTER_DEFENSE: 'ITO +',
        TURRET: 'Turret',
        ULTRA_LINK_AMP: 'Ultra-Link',
        ULTRA_STRIKE: 'Ultra-Strike',

    };

    function addItemToCount(item, countMap, incBy) {
        if (item[2] && item[2].resource && item[2].flipCard) {
            const key = `${item[2].resource.resourceType} ${item[2].flipCard.flipCardType}`;
            if (!countMap[key]) {
                countMap[key] = item[2].resource;
                countMap[key].count = 0;
            }
            countMap[key].flipCardType = item[2].flipCard.flipCardType;
            countMap[key].count += incBy;
        } else if (item[2] && item[2].resource) {
            const key = `${item[2].resource.resourceType} ${item[2].resource.resourceRarity}`;
            if (!countMap[key]) {
                countMap[key] = item[2].resource;
                countMap[key].count = 0;
            }
            countMap[key].count += incBy;
        } else if (item[2] && item[2].resourceWithLevels) {
            const key = `${item[2].resourceWithLevels.resourceType} ${item[2].resourceWithLevels.level}`;
            if (!countMap[key]) {
                countMap[key] = item[2].resourceWithLevels;
                countMap[key].count = 0;
            }
            countMap[key].count += incBy;
        } else if (item[2] && item[2].modResource) {
            const key = `${item[2].modResource.resourceType} ${item[2].modResource.rarity}`;
            if (!countMap[key]) {
                countMap[key] = item[2].modResource;
                countMap[key].count = 0;
            }
            countMap[key].count += incBy;
        } else {
            console.log(item);
        }
    }

    function svgToIcon(str, s) {
        const url = ("data:image/svg+xml," + encodeURIComponent(str)).replace(/#/g, '%23');
        return new L.Icon({
            iconUrl: url,
            iconSize: [s, s],
            iconAnchor: [s / 2, s / 2],
            className: 'no-pointer-events', //allows users to click on portal under the unique marker
        })
    }

    function createIcons() {
        thisPlugin.keyIcon = svgToIcon(`<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-key" width="44" height="44" viewBox="0 0 24 24" stroke-width="2" stroke="#ffffff" fill="none" stroke-linecap="round" stroke-linejoin="round">
<circle cx="8" cy="15" r="4" />
<line x1="10.85" y1="12.15" x2="19" y2="4" />
<line x1="18" y1="5" x2="20" y2="7" />
<line x1="15" y1="8" x2="17" y2="10" />
</svg>`, 15);
    }

    function prepareItemCounts(data) {
        if (!data || !data.result) {
            return [];
        }
        const countMap = {};
        data.result.forEach((item) => {
            addItemToCount(item, countMap, 1);
            if (item[2].container) {
                item[2].container.stackableItems.forEach((item) => {
                    addItemToCount(item.exampleGameEntity, countMap, item.itemGuids.length);
                });
            }
        });
        const countList = Object.values(countMap);
        countList.sort((a, b) => {
            if (a.resourceType === b.resourceType) {
                return 0;
            }
            return a.resourceType > b.resourceType ? 1 : -1;
        });
        return countList;
    }

    function HexToSignedFloat(num) {
        let int = parseInt(num, 16);
        if ((int & 0x80000000) === -0x80000000) {
            int = -1 * (int ^ 0xffffffff) + 1;
        }
        return int / 10e5;
    }

    function addKeyToCount(item, countMap, incBy, moniker) {
        if (item[2] && item[2].resource && item[2].resource.resourceType && item[2].resource.resourceType === 'PORTAL_LINK_KEY') {
            const key = `${item[2].portalCoupler.portalGuid}`;
            if (!countMap[key]) {
                countMap[key] = item[2];
                countMap[key].count = 0;
                countMap[key].capsules = [];
            }

            if (moniker && countMap[key].capsules.indexOf(moniker) === -1) {
                countMap[key].capsules.push(moniker);
            }

            countMap[key].count += incBy;
        }
    }

    function prepareKeyCounts(data) {
        if (!data || !data.result) {
            return [];
        }
        const countMap = {};
        data.result.forEach((item) => {
            addKeyToCount(item, countMap, 1);
            if (item[2].container) {
                item[2].container.stackableItems.forEach((item2) => {
                    addKeyToCount(item2.exampleGameEntity, countMap, item2.itemGuids.length, item[2].moniker.differentiator);
                });
            }
        });
        const countList = Object.values(countMap);
        countList.sort((a, b) => {
            if (a.portalCoupler.portalTitle === b.portalCoupler.portalTitle) {
                return 0;
            }
            return a.portalCoupler.portalTitle.toLowerCase() > b.portalCoupler.portalTitle.toLowerCase() ? 1 : -1;
        });
        return countList;
    }

    function displayInventory() {
        dialog({
            html: `<div id="live-inventory">
<table>
<thead>
<tr>
<th class="">Type</th>
<th class="">Rarity</th>
<th class="">Count</th>
</tr>
</thead>
<tbody>
${thisPlugin.itemCount.map((el)=> {
    return `<tr>
<td>${translations[el.resourceType]}</td>
<td>${el.flipCardType || el.resourceRarity || el.rarity || el.level}</td>
<td>${el.count}</td>
</tr>`;
}).join('')}
</tbody>
</table>
<hr/>
<table>
<thead>
<tr>
<th class="">Portal</th>
<th class="">Capsules</th>
<th class="">Count</th>
</tr>
</thead>
<tbody>
${thisPlugin.keyCount.map((el)=> {
    return `<tr>
<td><a href="#" onclick="zoomToAndShowPortal('${el.portalCoupler.portalGuid}',[${el.portalCoupler.portalLocation.split(',').map(e => {
        return HexToSignedFloat(e);
    }).join(',')}])">${el.portalCoupler.portalTitle}</a></td>
<td>${el.capsules.join(', ')}</td>
<td>${el.count}</td>
</tr>`;
}).join('')}
</tbody>
</table>
</div>`,
            title: 'Live Inventory',
            id: 'live-inventory',
            width: 'auto'
        });
    };

    function preparePortalKeyMap() {
        const keyMap = {};
        thisPlugin.keyCount.forEach((k) => {
            keyMap[k.portalCoupler.portalGuid] = k;
        });
        return keyMap;
    }

    function prepareData(data) {
        thisPlugin.itemCount = prepareItemCounts(data);
        thisPlugin.keyCount = prepareKeyCounts(data);
        thisPlugin.keyMap = preparePortalKeyMap();
    }

    function loadInventory() {
        try {
            const localData = JSON.parse(localStorage[KEY_SETTINGS]);
            if (localData && localData.expires > Date.now()) {
                prepareData(localData.data);
                return;
            }
        } catch (e) {}

        window.postAjax('getInventory', {
            "lastQueryTimestamp": 0
        }, (data, textStatus, jqXHR) => {
            localStorage[KEY_SETTINGS] = JSON.stringify({
                data: data,
                expires: Date.now() + 5 * 60 * 1000 // request data only once per five minutes, or we might hit a rate limit
            });
            prepareData(data);
        }, (data, textStatus, jqXHR) => {
            console.error(data);
        });
    };

    function portalDetailsUpdated(p) {
        if (!thisPlugin.keyMap) {
            return;
        }
        const countData = thisPlugin.keyMap[p.guid];
        if (countData) {
            $(`<tr><td>${countData.count}</td><th>Keys</th><th></th><td></td></tr>`)
                .appendTo($('#randdetails tbody'));
        }
    }

    function addKeyToLayer(data) {
        const tileParams = window.getCurrentZoomTileParameters ? window.getCurrentZoomTileParameters() : window.getMapZoomTileParameters();
        if (tileParams.level !== 0) {
            return;
        }

        if (thisPlugin.keyMap[data.portal.options.guid] && !data.portal._keyMarker) {
            data.portal._keyMarker = L.marker(data.portal._latlng, {
                icon: thisPlugin.keyIcon,
                interactive: false,
                keyboard: false,
            }).addTo(thisPlugin.layerGroup);
        }
    }

    function removeKeyFromLayer(data) {
        if (data.portal._keyMarker) {
            thisPlugin.layerGroup.removeLayer(data.portal._keyMarker);
            delete data.portal._keyMarker;
        }
    }

    function checkShowAllIcons(data) {
        const tileParams = window.getCurrentZoomTileParameters ? window.getCurrentZoomTileParameters() : window.getMapZoomTileParameters();
        if (tileParams.level !== 0) {
            thisPlugin.layerGroup.clearLayers();
            for (let id in window.portals) {
                delete window.portals[id]._keyMarker;
            }
        } else {
            for (let id in window.portals) {
                addKeyToLayer({
                    portal: window.portals[id]
                });
            }
        }
    }

    function setup() {
        loadInventory();
        $('<a href="#">')
            .text('Inventory')
            .click(displayInventory)
            .appendTo($('#toolbox'));
        window.addHook('portalDetailsUpdated', portalDetailsUpdated);
        window.addHook('portalAdded', addKeyToLayer);
        window.addHook('portalRemoved', removeKeyFromLayer);
        window.map.on('zoom', checkShowAllIcons);
    }

    function delaySetup() {
        thisPlugin.layerGroup = new L.LayerGroup();
        window.addLayerGroup('Portal keys', thisPlugin.layerGroup, false);
        createIcons();

        setTimeout(setup, 1000); // delay setup and thus requesting data, or we might encounter a server error
    }
    delaySetup.info = plugin_info; //add the script info data to the function as a property

    if (window.iitcLoaded) {
        delaySetup();
    } else {
        if (!window.bootPlugins) {
            window.bootPlugins = [];
        }
        window.bootPlugins.push(delaySetup);
    }
}


(function () {
    const plugin_info = {};
    if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) {
        plugin_info.script = {
            version: GM_info.script.version,
            name: GM_info.script.name,
            description: GM_info.script.description
        };
    }
    // Greasemonkey. It will be quite hard to debug
    if (typeof unsafeWindow != 'undefined' || typeof GM_info == 'undefined' || GM_info.scriptHandler != 'Tampermonkey') {
        // inject code into site context
        const script = document.createElement('script');
        script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(plugin_info) + ');'));
        (document.body || document.head || document.documentElement).appendChild(script);
    } else {
        // Tampermonkey, run code directly
        wrapper(plugin_info);
    }
})();
