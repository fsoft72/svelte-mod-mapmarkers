import {
	mapmarkers_admin_add,
	mapmarkers_admin_edit,
	mapmarkers_admin_del,
	mapmarkers_list,
} from './actions';
import type { Marker } from './types';

interface MapMarkerStore {
	markers: Marker[];
	add: ( data: Marker ) => Promise<Marker | undefined>;
	edit: ( data: Marker ) => Promise<Marker | undefined>;
	get: ( id: string ) => Marker | undefined;
	delete: ( id: string ) => Promise<void>;
	load: () => Promise<Marker[]>;
	list: () => Marker[];
};

const mapmarker_store: MapMarkerStore = $state( {
	markers: [],
	add: async ( data: Marker ) => {
		if ( !data.title || !data.position || !data.full_address ) {
			console.warn( 'D, title or position missing. Abort adding marker.' );
			return;
		}

		const res = await mapmarkers_admin_add( data.title, data.position, data.full_address, data.description, data.address, data.phone );
		if ( res.error ) return;

		mapmarker_store.markers.push( res );

		return mapmarker_store.get( res.id );
	},
	edit: async ( data: Marker ) => {
		if ( !data.id || !data.title || !data.position ) {
			console.warn( 'D, title or position missing. Abort editing marker.' );
			return;
		}

		const res = await mapmarkers_admin_edit( data.id, data.title, data.position, data.full_address, data.description, data.address, data.phone );
		if ( res.error ) return;

		const idx = mapmarker_store.markers.findIndex( ( m: Marker ) => m.id === res.id );

		mapmarker_store.markers[ idx ] = res;

		return mapmarker_store.get( res.id );
	},
	get: ( id: string ) => {
		const marker: Marker | undefined = mapmarker_store.markers.find( ( marker: Marker ) => marker.id === id );
		return marker;
	},
	delete: async ( id: string ) => {
		const res = await mapmarkers_admin_del( id );
		if ( res.error ) {
			console.error( 'Error deleting marker:', res.error );
			return;
		}

		const idx = mapmarker_store.markers.findIndex( ( marker: Marker ) => marker.id === id );
		delete mapmarker_store.markers[ idx ];
	},
	load: async () => {
		const res = await mapmarkers_list();
		if ( res.error ) {
			console.error( 'Error loading markers:', res.error );
			return [];
		}

		mapmarker_store.markers = res;
		return mapmarker_store.list();
	},
	list: () => Object.values( mapmarker_store.markers )
} );

export default mapmarker_store;