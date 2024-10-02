<script module lang="ts">
    type GeocoderType = { lat: number, lng: number } | {};

    export type GoogleAddressType = {
        address: string | '';
        city: string | '';
        postal_code: string | '';
        province: string | '';
        country: string | '';
        formatted: string | '';
        telephone?: string | '';
        position?: GeocoderType;
    };
</script>

<script lang="ts">
    import { PUBLIC_GOOGLE_MAPS_API_KEY } from '$env/static/public';
	import type { FormField } from '$liwe3/components/FormCreator.svelte';
    import Input from '$liwe3/components/Input.svelte';
    import Button from '$liwe3/components/Button.svelte';
    import { slide } from 'svelte/transition';
    import { sineInOut } from 'svelte/easing';
    import {Trash, Plus} from 'svelte-hero-icons';
    import { onDestroy, onMount } from 'svelte';

    interface Props {
        field: FormField;
        telephone?: boolean;    // show telephone field
        multiple?: boolean;     // multiple addresses
		// dependency injection
		_v: (field: FormField) => any;
		// events
        onchange: (name: string, value: any) => void;
		// extra
		[key: string]: any;
    };

    type ValuesType = Record<string, GoogleAddressType> | { [key: string]: GoogleAddressType };

    const API_URL = `https://maps.googleapis.com/maps/api/js?key=${PUBLIC_GOOGLE_MAPS_API_KEY}&loading=async`;

    // Keys must be the same as AutoCompleteType, also used to check if all keys/values are present
    const emptyValues: GoogleAddressType = {
        address: '',
        city: '',
        postal_code: '',
        province: '',
        country: '',
        formatted: '',
        telephone: '',
        position: {}
    };

    const prefix = 'address';
    let { onchange, _v, field, telephone = false, multiple = true, ...props }: Props = $props();

    let maps: any;
    let google: any;
    let placesLibrary: any;
    let listenerHandle: any;
    let libLoaded: boolean  = $state(false); // Google Maps library loaded
    let current:number      = $state(0);    // current address index
    let values:ValuesType   = $state({});   // all addresses values
    let counter:number      = $derived( Object.keys(values).length);


    /**
     * @description Clear undefined values from object and add missing keys to be compliant with AutoCompleteType
     * @param dct: Record<string, string | undefined>
     * @returns AutoCompleteType
     */
    const clear_undefined = ( dct: Record<string, string | {} | undefined> ):GoogleAddressType => {
        const res: any = {};
        Object.keys( emptyValues ).forEach( ( k ) => {
            if ( !dct[k] || dct[ k ] === undefined ){
                res[ k ] = '';
                 return;
            }
            res[ k ] = dct[ k ];
        } );
        return res;
    };

    /**
     * @description Load Google Maps API
     * @returns Promise
     */
    const loadGoogleMapsCore = async () => {
        // @ts-ignore
        (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window as WindowType;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
            key: PUBLIC_GOOGLE_MAPS_API_KEY,
            v: "weekly",
            // Use the 'v' parameter to indicate the version to use (weekly, beta, alpha, etc.).
            // Add other bootstrap parameters as needed, using camel case.
        });
    }

    const loadPlacesLibrary = async () => {
        // @ts-ignore
        if (!window.google || !window.google.maps) {
            try {
                await loadGoogleMapsCore();
            } catch (error) {
                console.error("Error loading Google Maps library:", error);
                throw error;
            }
        }
        // @ts-ignore
        maps = window.google.maps;

        // @ts-ignore
        const { PlacesLibrary } = await window.google.maps.importLibrary("places");
        return PlacesLibrary;
    };

   const addressGeocoder = (address: string): Promise<GeocoderType> => {
        return new Promise((resolve, reject) => {
            const geocoder = new maps.Geocoder();
            geocoder.geocode({ address }, (results: any, status: any) => {
                if (status === 'OK') {
                    const lat = results[0].geometry.location.lat();
                    const lng = results[0].geometry.location.lng();
                    resolve({ lat, lng });
                } else {
                    console.warn('Geocode was not successful for the following reason: ' + status);
                    resolve ({});
                }
            });
        });
    };

    /**
     * @description AutoComplete listener on address form field
     * @param e: Event
     * @returns void
     */
    const autoComplete = async (e: Event) => {
        const { address_components:place } = google.getPlace();
        if (!place)
            return;

        const tmp:Record<string, string | { lat: number, lng: number } | {} | undefined> = {};
        // clear form fields to avoid messy data when changing address
        clearFields();

        const typeMapping:Record<string, string> = {
            'route'                         : 'address',
            'street_number'                 : 'address',
            'locality'                      : 'city',
            'postal_code'                   : 'postal_code',
            'administrative_area_level_2'   : 'province',
            'country'                       : 'country'
        };
        // map google place fields to form fields and returned values

        place.map((p: any) => {
            if (!p.types) return;

            p.types.forEach((t: string) => {
                const objKey = typeMapping[t];
                if (!objKey) return;
                if (objKey) {
                    if (t === 'street_number') {
                        tmp[objKey] = p.long_name || '';
                    } else if (t === 'route') {
                        const number = tmp[objKey] === 'undefined' || tmp[objKey] === undefined ? '' : tmp[objKey];
                        tmp[objKey] = p.long_name + ' ' + number;
                    } else {
                        tmp[objKey] = p.short_name || p.long_name;
                    }
                }
            });
        });

        const googlePlace = google.getPlace();
        // add formatted address to returned values
        tmp.formatted = googlePlace.formatted_address;
        // keep telephone value when changing address
        tmp.telephone = values[prefix+current].telephone;
        // lat, lng
        tmp.position = await addressGeocoder(tmp.formatted as string);
        // update values so to trigger reactivity
        values[prefix+current] = { ...clear_undefined(tmp) as GoogleAddressType };
        //console.log('====> values', values);
        // call onchange event to return all values to FormCreator
        onchange (field.name, Object.values(values));
    }

    /**
     * @description Update FormCreator with telephone field value
     * @returns void
     */
    const telephoneField = () => {
        values[prefix+current] = { ...clear_undefined(values[prefix+current])};
        onchange (field.name, Object.values(values));
    }

    /**
     * @description Find targeted input field and the call addListener
     * @param e: Event
     * @returns void
     */
    const findListenerTarget = (e:Event) => {
        const input = e.target as HTMLInputElement;
        attachGoogleListener(input);
    }

    /**
     * @description Attach Google Maps Places Autocomplete listener to input field
     * @param input: HTMLInputElement
     * @returns void
     */
    const attachGoogleListener = (input:HTMLInputElement) => {
        listenerHandle && listenerHandle.remove();
        // @ts-ignore
        google = new window.google.maps.places.Autocomplete(input, { types: ['address'], fields: ['address_components', 'formatted_address'] });
        listenerHandle = google.addListener(`place_changed`, autoComplete);
    }

    /**
     * @description Feed fields with values from FormCreator
     * @returns void
     */
    const feedFields = () => {
        const v = _v(field);
        if (!v || v.length == 0) {
            addIt();
            return;
        }
        try {
            v.forEach((f: GoogleAddressType, idx:number) => {
                addIt(idx, f);
            });
        } catch (error) {
            console.error('Error feeding fields:', error);
        }
    }

    /**
     * @description Clear fields when changing address
     * @returns void
     */
    const clearFields = () => {
        let v: GoogleAddressType = { ...emptyValues };
        if (values[prefix+current].telephone !== '')
            v.telephone = values[prefix+current].telephone;
        values[prefix+current] = { ...v };
    }

    /**
     * @description Remove address item values from the values array and from the form (snippet each loop)
     * @param e: Event
     * @param id: number
     * @returns void
     */
    const trashIt = (e:Event, id:number) => {
        listenerHandle && listenerHandle.remove();
        if( !values[prefix+id]){
            console.warn ('Address item not found');
            return;
        }
        delete values[prefix+id];
        values = { ...values };
    }

    /**
     * @description Add a new address item to the values array and render it in the form (snippet each loop)
     * @param id: number
     * @param val: AutoCompleteType
     * @returns void
     */
    const addIt = (id?:number, val?:GoogleAddressType) => {
        id = id || counter;
        const spread = val || emptyValues;
        values[prefix+id] = { ...clear_undefined(spread) };
        current = id;
    }

    const clearEnv = () => {
        // @ts-ignore - google is not defined
        delete window.google;
        google = null;
        maps = null;
        placesLibrary = null;
        listenerHandle = null;
        libLoaded = false;
        values = {};
        current = 0;
    }

    /**
     * @description Initialize Google Maps and Places and attach listener to first input field on mount
     */
    onMount (async () => {
        try {
            placesLibrary = await loadPlacesLibrary();
            libLoaded = true;
            feedFields();
        } catch (error) {
            console.error('Failed to load Google Maps Places library:', error);
        }
    });

    /**
     * @description Remove all listeners on destroy
     */
    onDestroy(() => {
        listenerHandle && listenerHandle.remove();
        clearEnv();
    });
</script>

{#snippet trashBtn(id:number)}
    <Button mode="danger"
        icon={Trash}
        title="Remove this address"
        onclick={(e:Event) => trashIt(e, id)}>
    </Button>
{/snippet}

{#snippet singleAddress(values: ValuesType, id:number)}
    <div class="liwe3-col-12" transition:slide={{axis:'y', duration:200, easing:sineInOut}}>
        {#if telephone}
        <div class="liwe3-row liwe3-flex-bottom">
            <div class="liwe3-col-xs10">
                <Input
                    label="Telephone"
                    bind:value={values[prefix+id].telephone}
                    placeholder="Enter your telephone"
                    onchange={telephoneField}
                    onfocus={() => current = id}
                />
            </div>
            <div class="liwe3-offset-xs1 liwe3-col-xs1">
                {#if multiple}
                    {@render trashBtn(id)}
                {/if}
            </div>
        </div>
        <div class="liwe3-row">
            <div class="liwe3-col-xs12">
                <Input
                    label = {field.label}
                    id={`addressField${id}`}
                    bind:value={values[prefix+id].address}
                    placeholder="Enter your address"
                    onchange={(e:Event) => clearFields()}
                    onfocus={(e:Event) => {
                        current = id;
                        findListenerTarget(e);
                    }}
                />
            </div>
        </div>
        {:else}
        <div class="liwe3-row liwe3-flex-bottom">
            <div class="liwe3-col-xs10">
                <Input
                    label = {field.label}
                    id={`addressField${id}`}
                    bind:value={values[prefix+id].address}
                    placeholder="Enter your address"
                    onchange={(e:Event) => clearFields()}
                    onfocus={(e:Event) => {
                        current = id;
                        findListenerTarget(e);
                    }}
                />
            </div>
            <div class="liwe3-offset-xs1 liwe3-col-xs1">
                {#if multiple}
                    {@render trashBtn(id)}
                {/if}
            </div>
        </div>
        {/if}
        <div class="liwe3-row" style="z-index: 9999;">
            <div class="liwe3-col-xs12 liwe3-col-md5">
                <Input
                    bind:value={values[prefix+id].city}
                    placeholder="City"
                    disabled={true}
                />
            </div>
            <div class="liwe3-col-xs12 liwe3-col-md3">
                <Input
                    bind:value={values[prefix+id].postal_code}
                    placeholder="CAP"
                    disabled={true}
                />
            </div>
            <div class="liwe3-col-xs12 liwe3-col-md2">
                <Input
                    bind:value={values[prefix+id].province}
                    placeholder="Province"
                    disabled={true}
                />
            </div>
            <div class="liwe3-col-xs12 liwe3-col-md2">
                <Input
                    bind:value={values[prefix+id].country}
                    placeholder="Country"
                    disabled={true}
                />
            </div>
        </div>
    </div>
{/snippet}

{#if libLoaded }
    {#each Object.values(values) as value, idx}
        {@render singleAddress(values, idx)}
    {/each}
    {#if multiple}
        <div class="liwe3-row liwe3-p2 y">
            <span>
                <Button
                    mode="success"
                    size="sm"
                    title="Add a new address"
                    icon={Plus}
                    onclick={() => addIt() }>
                </Button>
            </span>
        </div>
    {/if}
{:else}
    <div class="liwe3-row liwe3-p2 y">
        <span><small>Loading Google Maps Library...</small></span>
    </div>
{/if}