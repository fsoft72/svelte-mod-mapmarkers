<script lang="ts">
    import { PUBLIC_GOOGLE_MAPS_API_KEY } from '$env/static/public';
	import { mkid } from '$liwe3/utils/utils';
    import { onMount, onDestroy } from 'svelte';
    import type { Marker } from '../types';
	import { marked } from 'marked';

    type WindowType = typeof window & {
        google: {
            maps: any;
        }
    };

    type Props = {
        markers: Marker[];
        center?: { lat: number, lng: number};
        zoom?: number;
        // pass custom method to create HTML marker
        createMarker?: (marker: Marker) => HTMLElement;
        // events
        onclick?: (AdvancedMarkerElement:any , marker: Marker) => void;
    };

    let {
        markers,
        center = $bindable({ lat: 45.450001, lng: 8.616667 }),
        zoom = 12,
        createMarker,
        onclick,
    }: Props = $props();

    let libs: any = $state(null);
    let init: any = $state(null);
    let win = window as WindowType;
    let map: any;
    let evts: any = [];
    let AdvancedMarkerElement: any;
    let google: WindowType['google'];

    const API_URL = `https://maps.googleapis.com/maps/api/js?key=${PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=maps`;

    const loadGoogleMapsCore = async () => {
        // @ts-ignore
        (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window as WindowType;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
            key: PUBLIC_GOOGLE_MAPS_API_KEY,
            v: "weekly",
            // Use the 'v' parameter to indicate the version to use (weekly, beta, alpha, etc.).
            // Add other bootstrap parameters as needed, using camel case.
        });
    };

    const initMap = async () => {
        google = win.google;

        const { Map } = await google.maps.importLibrary("maps");
        AdvancedMarkerElement = await google.maps.importLibrary("marker");

        const mapContainer = document.getElementById('map') as HTMLDivElement;

        map = new Map(mapContainer, {
            center,
            zoom,
            mapId: mkid('map')
        });
    };

    const centerMap = (center: { lat: number, lng: number}) => {
        if(!map) return;
        map.setCenter(center);
    };

    const createContent = (marker: Marker) => {

        if (createMarker) return createMarker(marker);

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

        return content;
    };

    const toggleMarker = (markerContent: any, data: Marker) => {
        if(!markerContent.details)
            markerContent.details = markerContent.content.querySelector('.liwe3-GMmarkers-details');
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
            const advancedMarkerElement = new google.maps.marker.AdvancedMarkerElement({
                map,
                position: marker.position,
                title: marker.title,
                content: createContent(marker),
            });

            evts.push ( advancedMarkerElement.addListener('click', () => {
                toggleMarker(advancedMarkerElement, marker);
                onclick && onclick(advancedMarkerElement, marker);
            }) );
        });
    }

    $effect(() => {
        centerMap(center);
    });

    onMount( async () => {
        libs = await loadGoogleMapsCore();
        init = await initMap();
        buildMarkers();
    });

    onDestroy(() => {
        //remove all markers event listener
        evts.map((evt:any) => evt.remove());
    });
</script>
<div id="map" class="target-div"></div>

<style>
    .target-div {
        width: 100%;
        height: 100%;
    }
</style>