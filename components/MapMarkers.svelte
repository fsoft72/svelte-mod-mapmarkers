<script lang="ts">
    import storeMapmarker from '../store.svelte';
    import FormCreator, { type FormField } from '$liwe3/components/FormCreator.svelte';
    import GoogleMapMarkers from './GoogleMapMarkers.svelte';
    import DataGrid, { type DataGridRow, type DataGridAction, type DataGridField } from '$liwe3/components/DataGrid.svelte';
    import Modal from '$liwe3/components/Modal.svelte';
    import { PencilSquare, Trash } from 'svelte-hero-icons';
	import { onMount } from 'svelte';
    import type { Marker } from '../types';

    type Props = {
        mapId?: string;
    };

    let { mapId }: Props = $props();

    /* FormCreator */
    let formFields: FormField[] = [
        {
            name: 'title',
            label: 'Title',
            type: 'text',
            required: true,
        },
        {
            name: 'description',
            label: 'Description',
            type: 'markdown',
            required: false,
        },
        {
            name: 'gAddress',
            label: 'Address',
            type: 'address',
            required: true,
        },
        {
            name: 'email',
            label: 'Email',
            type: 'email',
            required: false,
        },
        {
            name: 'website',
            label: 'Website',
            type: 'text',
            required: false,
        },
        {
            name: 'enabled',
            label: 'Enabled',
            type: 'checkbox',
            required: false,
        },
    ];

    /* DataGrid */
    const dataGridFields:DataGridField[] = [
        {
            name: 'title',
            label: 'Title',
            type: 'text'
        },
        {
            name: 'description',
            label: 'Description',
            type: 'text',
            hidden: true
        },
        {
            name: 'address',
            label: 'Address',
            type: 'text'
        },
        {
            name: 'enabled',
            label: 'Enabled',
            type: 'checkbox',
        }
    ];

    const dataGridActions: DataGridAction[] = [
        {
            id: 'edit',
            label: 'Edit',
            mode: 'warning',
            icon: PencilSquare,
            onclick: (row: DataGridRow) => {
                fields = rowToFields(row);
                formTitle = 'Edit Marker';
                modal = true;
            },
        },
        {
            id: 'delete',
            label: 'Delete',
            mode: 'danger',
            icon: Trash,
            onclick: async (row: DataGridRow) => {
                deleteMarker(row);
            },
        },
    ];

    const dataGridButtons = [
        {
            label: 'Add Marker',
            onclick: () => {
                formTitle = 'Add Marker';
                fields = {};
                modal = true;
            },
        },
    ];

    /* States */
    let markers: Marker[] = $state([]);
    let modal:boolean = $state(false);
    let fields:Record<string, any> = $state({});
    let formTitle:string = $state('');
    let lastMarker:{ lat: number, lng: number} = $derived(markers[markers.length - 1]?.position);
    let loaded:boolean = $state(false);

    const fieldsToMarker = (data: Record<string, any>) => {
        const pos = data.gAddress[0];
        const marker: Marker = {
            id: data.id || null,
            title: data.title,
            description: data?.description,
            address: pos.formatted,
            phone: pos.telephone,
            position: pos.position,
            full_address: data.gAddress,
            email: data.email,
            website: data.website,
            enabled: data.enabled || false
        };
        //console.log('fieldsToMarker', data, marker);
        return marker;
    };

    const rowToFields = (data: DataGridRow) => {
        const marker = storeMapmarker.get(data.id);
        if (!marker) return {};
        const g = marker.full_address ? marker.full_address: [];
        const fields: Record<string, any> = {
            id: marker.id,
            title: marker.title,
            description: marker.description,
            gAddress: g,
            email: marker.email,
            website: marker.website,
            enabled: marker.enabled
        };
        return fields;
    };

    const saveMarker = async (data: Record<string, any>) => {
        //console.log( 'saveMarker', data);
        const marker = fieldsToMarker(data);
        try {
            if (data.id) {
                await storeMapmarker.edit(marker);
            } else {
                await storeMapmarker.add(marker);
            }
        } catch (e) {
            console.error(e);
        }
        fields = {...{}};
        markers = storeMapmarker.list();
    };

    const deleteMarker = async (row: DataGridRow) => {
        await storeMapmarker.delete(row.id);
        markers = storeMapmarker.list();
    };

    const loadMarkers = async () => {
        markers = await storeMapmarker.loadAdmin();
        loaded = true;
        return markers;
    };

    onMount (async () => {
        markers = await loadMarkers();
    });
</script>

{#if loaded}
<div class="marker-container">
    <div class="marker-left">
        <GoogleMapMarkers markers={markers} center={lastMarker} {mapId} />
    </div>
    <div class="marker-right">
        <DataGrid
            data={markers}
            fields={dataGridFields}
            actions={dataGridActions}
            buttons = {dataGridButtons}
        />
    </div>
</div>
{/if}
{#if modal}
    <Modal
        title={formTitle}
        size="sm"
        closeOnEsc={false}
        closeOnOutsideClick={false}
        onclose={() => modal = false}
        oncancel={() => modal = false}
    >
        <FormCreator
            fields={formFields}
            values={$state.snapshot(fields)}
            onsubmit={(formValues) => { saveMarker(formValues);}}
        />
    </Modal>
{/if}
<style>
    .marker-container {
        display: grid;
        grid-template-columns: 1fr 2fr;
        grid-template-rows: 100%;
        gap: .5rem;
        width: 100%;
        height: 85vh;
    }
    .marker-left {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-width: 100%;
        height: 100%;
    }
    .marker-right {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: start;
        min-width: 100%;
        height: 100%;
    }
</style>