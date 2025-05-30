<script lang="ts">
    import { onDestroy, onMount } from 'svelte';

    import LocalizationStore from '$liwe3/stores/LocalizationStore.svelte';

    type PropsType = {
        coords?: { lat: number, lng: number };
        tracking?: boolean;
        options?: {
            enableHighAccuracy?: boolean;   // Optional: Use GPS for higher accuracy
            timeout?: number;               // Optional: Maximum time to wait for location
            maximumAge?: number;            // Optional: Maximum age of cached location
        };

        onerror?: (code: number, error: string) => void;
    };

    let { coords=$bindable(), tracking, options, onerror }:PropsType = $props();

    const _ = LocalizationStore._;
    let watchId: number;

    const success = (position: GeolocationPosition) => {
        coords = { lat: position.coords.latitude, lng: position.coords.longitude };
    };

    const error = (err: GeolocationPositionError) => {
        console.error('Geolocation error:', err.code, err.message);
        onerror && onerror(err.code, err.message);
    };

    const startTracking = () => {
        watchId = navigator.geolocation.watchPosition(success, error, options);
    }

    const getPosition = () => {
        navigator.geolocation.getCurrentPosition(success, error, options);
    }

    onMount( async () => {
        if( !navigator.geolocation ) {
            console.warn(_('Geolocation is not supported by your browser'));
            onerror && onerror(1, _('Geolocation is not supported by your browser'));
            return;
        }

        if ( tracking )
            startTracking();
        else
            getPosition();
    });

    onDestroy(() => {
        if( watchId )
            navigator.geolocation.clearWatch(watchId);
    });
</script>
