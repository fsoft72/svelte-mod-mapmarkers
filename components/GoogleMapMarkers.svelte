<script module lang="ts">
    import type { Marker } from '../types';
    export interface GoogleMapMarkerProps {
        markers: Marker[];
        center?: { lat: number, lng: number};
        zoom?: number;
        // Google Map ID defined in Google console
        mapId?: string;
        reset?: boolean;
        // pass custom method to create HTML marker
        createMarker?: (marker: Marker) => HTMLElement;
        // define a function to calculate the range based on zoom level
        calcRange?: (zoom: number, zoomToRadius?: {[key: number]: number}) => number;
        // events
        onclick?: (AdvancedMarkerElement:any , marker: Marker) => void;
        onrendered?: (map: any) => void;
        ondrag?: (center: google.maps.LatLngLiteral, zoom: number, range: number) => void;
        onzoom?: (center: google.maps.LatLngLiteral, zoom: number, range: number) => void;
    };

</script>
<script lang="ts">
    import { PUBLIC_GOOGLE_MAPS_API_KEY } from '$env/static/public';
	import { mkid } from '$liwe3/utils/utils';
    import { goto } from '$app/navigation';
    import { onMount, onDestroy } from 'svelte';
	import { marked } from 'marked';

    let {
        markers,
        center = $bindable({ lat: 45.450001, lng: 8.616667 }),
        zoom = 12,
        mapId = mkid('map'),

        reset = false,
        createMarker,
        calcRange,

        onclick,
        onrendered,
        ondrag,
        onzoom
    }: GoogleMapMarkerProps = $props();

    let libs: any = $state(null);
    let init: any = $state(null);

    let mapDiv: HTMLDivElement;
    let map: google.maps.Map | null = null;
    let evts: any = [];
    let markerEvts: any = [];
    let AdvancedMarkerElement: any;
    let range = $derived.by(() => calculateRange(zoom)); // Derived state for range

    const loadGoogleMapsCore = async () => {
        // @ts-ignore
        (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window as WindowType;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
            key: PUBLIC_GOOGLE_MAPS_API_KEY,
            v: "weekly",
            // Use the 'v' parameter to indicate the version to use (weekly, beta, alpha, etc.).
            // Add other bootstrap parameters as needed, using camel case.
        });
    };

    const calculateRange = (zoom: number, zoomToRadius?:{[key: number]: number}) => {
        if(calcRange) {
            return calcRange(zoom, zoomToRadius);
        }
        // Define a function to convert zoom levels into search radius
        const ztr:{[key: number]: number} = zoomToRadius || {
            20: 0.4,    // 400 meters
            18: 1.5,    // 1.5 km
            16: 3.5,    // 3.5 km
            14: 11,     // 11 km
            12: 32.5,   // 32.5 km
            10: 97,     // 97 km
            8: 150,     // 150 km
            6: 275,     // 275 km
            4: 400      // 400 km
        };
        return ztr[zoom] || 10; // Default to 10 km if undefined
    };

    const initMap = async () => {

        await google.maps.importLibrary("maps");
        AdvancedMarkerElement = await google.maps.importLibrary("marker");

        map = new google.maps.Map(mapDiv, {
            center,
            zoom,
            mapId
        });

        // Add drag listener
        if (map) {
            if (ondrag){
                const dragListener = map.addListener('dragend', () => {
                    //@ts-ignore - map is verified not null
                    const newCenter = map.center.toJSON();
                    if (newCenter && ondrag) {
                        ondrag(newCenter, zoom, range);
                    }
                });
                evts.push(dragListener);
            }

            if (onzoom){
                const zoomLIstemner = map.addListener('zoom_changed', () => {
                    //@ts-ignore - map is verified not null
                    const newZoom = map.getZoom();
                    if (newZoom) {
                        zoom = newZoom;
                        onzoom(center, zoom, range);
                    }
                });
                evts.push(zoomLIstemner);
            }
        }

        onrendered && onrendered(map);
    };

    const centerMap = (center: { lat: number, lng: number}) => {
        if(!map) return;
        map.setCenter(center);
        //ondrag && ondrag(center);
    };

    const addTouchAndClickEvents = (content: HTMLElement) => {
        const anchors: HTMLAnchorElement[] = [...content.querySelectorAll('a')];
        anchors.forEach(anchor => {
            const handler = (e: Event) => {
                e.stopPropagation();
                // For tel/mailto, just let the browser handle it
                if (
                    anchor.target === '_blank' ||
                    anchor.href.startsWith('mailto:') ||
                    anchor.href.startsWith('tel:')
                ) {
                    window.open(anchor.href, anchor.target || '_self');
                } else {
                    const url = new URL(anchor.href, window.location.origin);
                    if (!url.origin || url.origin === window.location.origin) {
                        e.preventDefault();
                        goto(anchor.href);
                    } else {
                        window.location.href = anchor.href;
                    }
                }
            };
            markerEvts.push(anchor.addEventListener('touchend', handler));
            markerEvts.push(anchor.addEventListener('click', handler));
        });
    };

    const createContent = (marker: Marker) => {

        if (createMarker) return _createMarker(marker);

        // most of theese fields are already filtered out in the backend
        const exclude = ['position', 'id', 'full_address', 'created', 'updated', 'domain'];
        const content = document.createElement('div');
        content.classList.add('liwe3-GMmarkers');
        let innerContent = `
        <div class="liwe3-GMmarkers-cnt">
            <div class="liwe3-GMmarkers-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black" width="24px" height="24px">
                    <path d="M12 2C7.03 2 3 6.03 3 11c0 5.25 9 13 9 13s9-7.75 9-13c0-4.97-4.03-9-9-9zm0 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                    <path d="M0 0h24v24H0z" fill="none"/>
                </svg>
            </div>
            <div class="liwe3-GMmarkers-details">
                <div class="liwe3-GMmarkers-title">${marker.title}</div>
                <div class="liwe3-GMmarkers-description">${marked.parse(marker.description!, { gfm: true })}</div>
                <div class="liwe3-GMmarkers-address">
                    <p>${marker.address}</p>
                    <p><a href="tel:${marker.phone}">${marker.phone}</a></p>
                    <p><a href="mailto:${marker.email}">${marker.email}</a></p>
                    <p><a href="https://${marker.website}" target="_blank">${marker.website}</a></p>
                </div>
            </div>
        </div>
        `;
        content.innerHTML = innerContent;

        addTouchAndClickEvents(content);

        return content;
    };

    const _createMarker = (marker: Marker) => {
        if(!createMarker) return;

        const content = createMarker(marker);
        addTouchAndClickEvents(content);
        return content;
    };

    const toggleMarker = (markerContent: any, data: Marker) => {
        if(!markerContent.details)
            markerContent.details = markerContent.content.querySelector('.liwe3-GMmarkers-details');
            if(!markerContent.details)
                return;
        if(!markerContent.cnt)
            markerContent.cnt = markerContent.content.querySelector('.liwe3-GMmarkers-cnt');
        if (markerContent.classList.contains('marker-active')) {
            markerContent.classList.remove('marker-active');
            markerContent.cnt.classList.remove('marker-active');
            markerContent.zIndex = null;
            markerContent.details.style.display = 'none';
            return;
        }
        markerContent.classList.add('marker-active');
        markerContent.cnt.classList.add('marker-active');
        markerContent.zIndex = 1;
        markerContent.details.style.display = 'block';
    };

    const buildMarkers = () => {
        markers.forEach((marker: Marker) => {
            const position = {
                lat: Number(marker.position.lat),
                lng: Number(marker.position.lng),
            };

            //console.log('Creating marker at:', position);
            const advancedMarkerElement = new google.maps.marker.AdvancedMarkerElement({
                map,
                position,
                title: marker.title,
                content: createContent(marker),
            });

            evts.push ( advancedMarkerElement.addListener('gmp-click', () => {
                toggleMarker(advancedMarkerElement, marker);
                onclick && onclick(advancedMarkerElement, marker);
            }) );
        });
    }

    $effect(() => {
        centerMap(center);
    });

    $effect ( () => {
        markers;
        if (map && markers.length > 0) {
            buildMarkers();
        }
    });

    $effect(() => {
        if (reset) {
            ( async () => {
                map = null;
                await initMap();
            })();
        }
    });

    onMount( async () => {
        libs = await loadGoogleMapsCore();
        init = await initMap();

       buildMarkers();
    });

    onDestroy(() => {
        //remove all markers event listener
        evts.map((evt:any) => evt.remove());
        markerEvts.map((evt:any) => evt?.remove());
    });
</script>
<div bind:this={mapDiv} class="target-div"></div>

<style>
    .target-div {
        width: 100%;
        height: 100%;
    }
</style>