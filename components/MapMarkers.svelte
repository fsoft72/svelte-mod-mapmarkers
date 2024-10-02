<script lang="ts">
    import mapmarkers_store from '../store.svelte';
    import FormCreator, { type FormField } from '$liwe3/components/FormCreator.svelte';
    import GoogleMapMarkers from './GoogleMapMarkers.svelte';
    import DataGrid, { type DataGridRow, type DataGridAction, type DataGridField } from '$liwe3/components/DataGrid.svelte';
    import Modal from '$liwe3/components/Modal.svelte';
    import { PencilSquare, Trash } from 'svelte-hero-icons';
	import { onMount } from 'svelte';
    import type { Marker, MarkerPosition } from '../types';
	import type { GridDataRow } from '$liwe3/components/DataGrid1.svelte';

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
            type: 'Address',
            required: true,
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
            name: 'Address',
            label: 'Address',
            type: 'text'
        },
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
            full_address: data.gAddress
        };
        return marker;
    };

    const rowToFields = (data: DataGridRow) => {
        const marker = mapmarkers_store.get(data.id);
        if (!marker) return {};
        const g = marker.full_address ? marker.full_address: [];
        const fields: Record<string, any> = {
            id: marker.id,
            title: marker.title,
            description: marker.description,
            gAddress: g
        };
        return fields;
    };

    const saveMarker = async (data: Record<string, any>) => {
        const marker = fieldsToMarker(data);
        if (data.id) {
            await mapmarkers_store.edit(marker);
        } else {
            await mapmarkers_store.add(marker);
        }
        markers = mapmarkers_store.list();
    };

    const deleteMarker = async (row: GridDataRow) => {
        await mapmarkers_store.delete(row.id);
        markers = mapmarkers_store.list();
    };

    const loadMarkers = async () => {
        markers = await mapmarkers_store.load();
        loaded = true;
        return markers;
    };

    onMount (async () => {
        markers = await loadMarkers();
    });
</script>

<div class="marker-container">
    <div class="marker-left">
        <div class="full-height">
            {#key markers}
                <GoogleMapMarkers markers={markers} center={lastMarker} />
            {/key}
        </div>
    </div>
    <div class="marker-right">
        <div class="full-height">
            {#key markers}
                <DataGrid
                    data={markers}
                    fields={dataGridFields}
                    actions={dataGridActions}
                    buttons = {dataGridButtons}
                />
            {/key}
        </div>
    </div>
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
</div>
<style>
    .marker-container {
        position: relative;
        flex: 1;
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        height: calc(100% - 4rem);
        min-width: 100%;
        min-height: calc(100% - 4rem);
        margin-top: 0.5rem;
    }
    .marker-left {
        position: relative;
        flex: .4 1 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 40%;
        height: 100%;
    }
    .marker-right {
        position: relative;
        flex: .6 1 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 60%;
        height: 100%;
    }
    .full-height {
        position: absolute;
        top: 0;
        bottom: 0;
        left:0;
        width: 100%;
        min-width: 100%;
        height: 100%;
        min-height: 100%;
    }
</style>