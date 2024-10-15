import {
	mapmarkers_admin_add,
	mapmarkers_admin_edit,
	mapmarkers_admin_del,
	mapmarkers_list,
	mapmarkers_admin_list,
} from './actions';
import type { Marker } from './types';

interface MapMarkerStore {
	markers: Marker[];
	add: ( data: Marker ) => Promise<Marker | undefined>;
	edit: ( data: Marker ) => Promise<Marker | undefined>;
	get: ( id: string ) => Marker | undefined;
	delete: ( id: string ) => Promise<void>;
	loadAdmin: () => Promise<Marker[]>;
	load: () => Promise<Marker[]>;
	list: () => Marker[];
};

const storeMapmarker: MapMarkerStore = $state( {
	markers: [],
	add: async ( data: Marker ) => {
		if ( !data.title || !data.position || !data.full_address ) {
			console.warn( 'ADD, title or position missing. Abort adding marker.' );
			return;
		}

		const res = await mapmarkers_admin_add( data.title, data.position, data.full_address, data.description, data.address, data.phone, data.email, data.website, data.enabled );
		if ( res.error ) return;

		storeMapmarker.markers.push( res );

		return storeMapmarker.get( res.id );
	},
	edit: async ( data: Marker ) => {
		if ( !data.id || !data.title || !data.position ) {
			console.warn( 'EDIT, title or position missing. Abort editing marker.' );
			return;
		}

		const res = await mapmarkers_admin_edit( data.id, data.title, data.position, data.full_address, data.description, data.address, data.phone, data.email, data.website, data.enabled );

		if ( res.error ) return;

		const idx = storeMapmarker.markers.findIndex( ( m: Marker ) => m.id === res.id );

		storeMapmarker.markers[ idx ] = res;

		return storeMapmarker.get( res.id );
	},
	get: ( id: string ) => {
		console.log( 'storeMapmarker.get', storeMapmarker.markers );
		const marker: Marker | undefined = storeMapmarker.markers.find( ( marker: Marker ) => marker.id === id );
		return marker;
	},
	delete: async ( id: string ) => {
		const res = await mapmarkers_admin_del( id );
		if ( res.error ) {
			console.error( 'Error deleting marker:', res.error );
			return;
		}

		const idx = storeMapmarker.markers.findIndex( ( marker: Marker ) => marker.id === id );
		delete storeMapmarker.markers[ idx ];
	},
	loadAdmin: async () => {
		const res = await mapmarkers_admin_list();
		if ( res.error ) {
			console.error( 'Error loading markers:', res.error );
			return [];
		}

		storeMapmarker.markers = res;
		return storeMapmarker.list();
	},
	load: async () => {
		const res = await mapmarkers_list();
		if ( res.error ) {
			console.error( 'Error loading markers:', res.error );
			return [];
		}

		storeMapmarker.markers = res;
		return storeMapmarker.list();
	},
	list: () => Object.values( storeMapmarker.markers )
} );

export default storeMapmarker;