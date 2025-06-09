<script lang="ts">
    import GoogleMapMarkers from './GoogleMapMarkers.svelte';
    import { addToast } from '$liwe3/stores/ToastStore.svelte';

    import LocalizationStore from '$liwe3/stores/LocalizationStore.svelte';

    import type { Marker } from '$modules/mapmarkers/types';
	import { onMount, onDestroy } from 'svelte';
    import type { GoogleMapMarkerProps } from './GoogleMapMarkers.svelte';
    import { runeDebug } from '$liwe3/utils/runes.svelte';

    interface PropsType extends GoogleMapMarkerProps {
        key?: number;
        mode?: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
        onresponse?: (response: any) => void;
        // New properties for enhanced routing
        avoidHighways?: boolean;
        avoidTolls?: boolean;
        avoidFerries?: boolean;
        optimizeWaypoints?: boolean;
        unitSystem?: 'METRIC' | 'IMPERIAL';
        region?: string; // ISO 3166-1 country code for region biasing
    };

    let {
        key,
        markers,
        mode = $bindable(),
        mapId,
        createMarker,
        onclick,
        onresponse,
        ondrag,
        avoidHighways = false,
        avoidTolls = false,
        avoidFerries = false,
        optimizeWaypoints = true,
        unitSystem = 'METRIC',
        region = 'IT' // Default to Italy based on your location
    }: PropsType = $props();

    const _ = LocalizationStore._;

    let waypoints: any = {
        origin: '',
        destination: '',
    };

    let map: google.maps.Map | null = $state(null);
    let resetMap: boolean = $state(false);
    let directionsService: google.maps.DirectionsService | null = $state(null);
    let directionsRenderer: google.maps.DirectionsRenderer | null = $state(null);

    /**
     * @description Initialize Google Maps libraries for directions
     */
    const initializeDirectionsServices = async () => {
        try {
            // Initialize traditional services (still supported but enhanced)
            directionsService = new google.maps.DirectionsService();

            // Configure directions renderer with modern options
            directionsRenderer = new google.maps.DirectionsRenderer({
                suppressMarkers: true,
                map,
                polylineOptions: {
                    strokeColor: '#4285F4',
                    strokeWeight: 6,
                    strokeOpacity: 0.8
                },
                panel: null // Set to DOM element if you want turn-by-turn directions
            });

        } catch (error) {
            console.error('Error initializing directions services:', error);
            // Fallback to basic DirectionsService
            directionsService = new google.maps.DirectionsService();
            directionsRenderer = new google.maps.DirectionsRenderer({
                suppressMarkers: true,
                map
            });
        }
    };

    /**
     * @description Create waypoints from markers with enhanced validation
     */
    const createWaypoint = () => {
        const filtered = markers.filter((marker: Marker) =>
            marker.position &&
            typeof marker.position.lat === 'number' &&
            typeof marker.position.lng === 'number' &&
            !isNaN(marker.position.lat) &&
            !isNaN(marker.position.lng)
        );

        if (filtered.length < 2) {
            addToast({
                title: 'Route Error',
                message: _('Route must have at least 2 valid waypoints with coordinates.'),
                type: 'error'
            });
            return false;
        }

        // Normalize position format for DirectionsService
        const normalizePosition = (pos: any) => {
            const lat = Number(pos.lat);
            const lng = Number(pos.lng);

            // Validate coordinates
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                throw new Error(`Invalid coordinates: lat=${lat}, lng=${lng}`);
            }

            return { lat, lng };
        };

        try {
            waypoints = {
                origin: normalizePosition(filtered[0].position),
                destination: normalizePosition(filtered[filtered.length - 1].position),
                travelMode: getTravelMode(mode),
                avoidHighways,
                avoidTolls,
                avoidFerries,
                optimizeWaypoints: filtered.length > 2 ? optimizeWaypoints : false,
                unitSystem: google.maps.UnitSystem[unitSystem] || google.maps.UnitSystem.METRIC,
                region: region.toLowerCase()
            };

            // Add intermediate waypoints if more than 2 markers
            if (filtered.length > 2) {
                const intermediates = filtered.slice(1, -1).map((marker: Marker) => ({
                    location: normalizePosition(marker.position),
                    stopover: true,
                }));
                waypoints.waypoints = intermediates;
            }

            return true;
        } catch (error) {
            console.error('Error creating waypoints:', error);
            addToast({
                title: 'Waypoint Error',
                message: _('Invalid coordinates detected in markers.'),
                type: 'error'
            });
            return false;
        }
    };

    /**
     * @description Get Google Maps travel mode from string
     * @param mode: string
     * @returns google.maps.TravelMode
     */
    const getTravelMode = (mode?: string): google.maps.TravelMode => {
        const modeMap: Record<string, google.maps.TravelMode> = {
            'DRIVING': google.maps.TravelMode.DRIVING,
            'WALKING': google.maps.TravelMode.WALKING,
            'BICYCLING': google.maps.TravelMode.BICYCLING,
            'TRANSIT': google.maps.TravelMode.TRANSIT
        };

        return modeMap[mode || 'DRIVING'] || google.maps.TravelMode.DRIVING;
    };

    /**
     * @description Enhanced route calculation with modern Places API integration
     */
    const calculateRoute = async (): Promise<boolean> => {
        if (!directionsService || !directionsRenderer) {
            await initializeDirectionsServices();
        }

        if (!directionsService) {
            addToast({
                title: 'Service Error',
                message: _('Directions service not available. Please try again.'),
                type: 'error'
            });
            return false;
        }

        try {
            const request: google.maps.DirectionsRequest = {
                ...waypoints,
                provideRouteAlternatives: true, // Get alternative routes
                drivingOptions: mode === 'DRIVING' ? {
                    departureTime: new Date(),
                    trafficModel: google.maps.TrafficModel.BEST_GUESS
                } : undefined,
                transitOptions: mode === 'TRANSIT' ? {
                    modes: [
                        google.maps.TransitMode.BUS,
                        google.maps.TransitMode.RAIL,
                        google.maps.TransitMode.SUBWAY,
                        google.maps.TransitMode.TRAIN,
                        google.maps.TransitMode.TRAM
                    ],
                    routingPreference: google.maps.TransitRoutePreference.LESS_WALKING
                } : undefined
            };

            const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
                directionsService!.route(request, (result, status) => {
                    if (status === google.maps.DirectionsStatus.OK && result) {
                        resolve(result);
                    } else {
                        reject(new Error(_('Directions request failed:') + status));
                    }
                });
            });

            // Set the route on the map
            directionsRenderer!.setDirections(result);

            const enhancedResponse = {
                ...result,
                metadata: {
                    totalDistance: result.routes[0]?.legs.reduce((total, leg) =>
                        total + (leg.distance?.value || 0), 0),
                    totalDuration: result.routes[0]?.legs.reduce((total, leg) =>
                        total + (leg.duration?.value || 0), 0),
                    totalDurationInTraffic: result.routes[0]?.legs.reduce((total, leg) =>
                        total + (leg.duration_in_traffic?.value || leg.duration?.value || 0), 0),
                    alternativeRoutesCount: result.routes.length - 1,
                    hasTrafficData: result.routes[0]?.legs.some(leg => leg.duration_in_traffic),
                    waypoints: waypoints,
                    travelMode: mode
                }
            };

            resetMap = false;
            onresponse && onresponse(enhancedResponse);

            // Show success notification for complex routes
            /* FIXME: toast is rendered multiple times
            if (markers.length > 2) {
                addToast({
                    title: 'Route Calculated',
                    message: _('Route calculated successfully. Number of waypoints:') + ` ${markers.length}`,
                    type: 'success'
                });
            }
            */
            return true;

        } catch (error) {
            console.error('Error calculating route:', error);

            const errorMessage = getErrorMessage(error);
            addToast({
                title: 'Route Calculation Failed',
                message: errorMessage,
                type: 'error'
            });

            return false;
        }
    };

    /**
     * @description Get user-friendly error message based on error type
     * @param error: any
     * @returns string
     */
    const getErrorMessage = (error: any): string => {
        const errorString = error.toString().toLowerCase();

        if (errorString.includes('zero_results')) {
            return _('No route could be found between the selected points.');
        } else if (errorString.includes('over_query_limit')) {
            return _('Too many requests. Please try again in a moment.');
        } else if (errorString.includes('request_denied')) {
            return _('Route request was denied. Please check your API key.');
        } else if (errorString.includes('invalid_request')) {
            return _('Invalid route request. Please check your waypoints.');
        } else if (errorString.includes('unknown_error')) {
            return _('Unknown error occurred. Please try again.');
        } else {
            return _('Could not calculate the route. Please try again.');
        }
    };

    /**
     * @description Main function to show route with enhanced error handling
     */
    const showRoute = async (): Promise<void> => {
        if (!createWaypoint()) {
            return;
        }

        await calculateRoute();
    };

    /**
     * @description Handle map rendered event and initialize directions
     * @param m: google.maps.Map
     */
    const mapRendered = async (m: google.maps.Map) => {
        if (!m) return;

        map = m;
        await initializeDirectionsServices();
        await showRoute();
    };

    /**
     * @description Clear current route from map
     */
    const clearRoute = () => {
        if (directionsRenderer) {
            directionsRenderer.setDirections({
                routes: [],
                request: { destination: {}, origin: {}, travelMode: google.maps.TravelMode.DRIVING }
            } as google.maps.DirectionsResult);
        }
    };

    /**
     * @description Switch to alternative route by index
     * @param routeIndex: number
     */
    const switchToAlternativeRoute = (routeIndex: number) => {
        if (directionsRenderer) {
            directionsRenderer.setRouteIndex(routeIndex);
        }
    };

    const newRoute= async () => {
        // Reset the map and directions renderer
        resetMap = true;
        clearRoute();
        await showRoute();
    };

    // Reactive effect for mode changes
    $effect(() => {
        (async () => {
            if (map && mode && directionsService) {
                await newRoute();
            }
        })();
    });

    onMount (async () => {
        // If markers are already set, show the route
        if (markers && markers.length > 0) {
            await newRoute();
        }
    });

    // Cleanup on component destroy
    onDestroy(() => {
        if (directionsRenderer) {
            directionsRenderer.setMap(null);
        }
    });

    // Export functions for external use
    export const exportedFunctions = {
        clearRoute,
        switchToAlternativeRoute,
        recalculateRoute: showRoute
    };
</script>

<GoogleMapMarkers
    {markers}
    {mapId}
    {createMarker}
    reset={resetMap}
    {onclick}
    onrendered={mapRendered}
    {ondrag}
/>