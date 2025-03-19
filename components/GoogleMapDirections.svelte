<script lang="ts">
    import GoogleMapMarkers from './GoogleMapMarkers.svelte';
	import { addToast } from '$liwe3/stores/ToastStore.svelte';

    import type { Marker } from '$modules/mapmarkers/types';
    import type { GoogleMapMarkerProps } from './GoogleMapMarkers.svelte';
	import { runeDebug } from '$liwe3/utils/runes.svelte';

    interface PropsType extends GoogleMapMarkerProps {
        key?: number;
        mode?: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
        onresponse?: (response: any) => void;
    };

    let { key, markers, mode = $bindable(), mapId, createMarker, onclick, onresponse, ondrag }:PropsType = $props();

    let waypoints:any = {
        origin: '',
        destination: '',
    };

    let map: google.maps.Map | null = $state(null);
    let resetMap: boolean = $state(false);

    const createWaypoint = () => {
        const filtered = markers.filter((marker: Marker) => marker.position);

        if (filtered.length < 2) {
            console.error('Route must have at least 2 waypoints.');
            return;
        }
        // Normalize position format for DirectionsService
        const normalizePosition = (pos: any) => ({
            lat: Number(pos.lat),
            lng: Number(pos.lng)
        });

        waypoints = {
            //@ts-ignore - Markers are filtered, so we can safely access the first element
            origin: normalizePosition(filtered[0]?.position),
            //@ts-ignore - Markers are filtered, so we can safely access the last element
            destination: normalizePosition(filtered[filtered.length - 1].position),
            travelMode: mode || google.maps.TravelMode.DRIVING,
        };

        if (filtered.length === 2) return;

        const intermediates = filtered.slice(1, -1).map((marker: Marker) => {
            return {
                //@ts-ignore - Markers are filtered
                location: normalizePosition(marker.position),
                stopover: true,
            };
        });
        waypoints.waypoints = intermediates;
        //runeDebug('createWaypoint', waypoints );
    };

    const calculateRoute = async () => {
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            map
        });

        try {
            const result = await directionsService.route( waypoints );
            directionsRenderer.setDirections(result);
            //runeDebug('calculateRoute', result);
            resetMap = false;
            onresponse && onresponse(result);
        } catch (error) {
            console.error('Error calculating route:', error);
            addToast({
                title: 'Error',
                message: 'Could not calculate the route. Please try again.',
                type: 'error'
            });
            console.warn( 'Could not calculate the route. Please try again.', 'error');
        }
    };

    const showRoute = () => {
        createWaypoint();
        calculateRoute();
    };

    const mapRendered = (m:google.maps.Map) => {
        if (!m) return;
        map = m;
        showRoute();
    };

    $effect(() => {
        if(map && mode) {
            resetMap = true;
            showRoute();
        }
    });
</script>
<GoogleMapMarkers {markers} {mapId} {createMarker} reset={resetMap} {onclick} onrendered={mapRendered} {ondrag} />