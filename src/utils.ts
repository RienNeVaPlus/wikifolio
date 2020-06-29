import {JSDOM} from 'jsdom'
import * as requestPromise from 'request-promise-native'

const emptyValues = ['', '-', 'N/A'];

export function parseHtml(html: string){
	const {window} = new JSDOM(html);
	const {document} = window;
	return {window, document,
		$: (selector: string) => document.querySelector(selector) as HTMLElement,
		$$: (selector: string) => Array.from(document.querySelectorAll(selector)),
		attribute: (selector: string, attr: string) => { return document.querySelector(selector)![attr]; },
		string: get.bind(null, document, 'string'),
		int: get.bind(null, document, 'int'),
		float: get.bind(null, document, 'float'),
		date: get.bind(null, document, 'date'),
		currency: get.bind(null, document, 'currency')
	}
}

type ValueType = 'string' | 'int' | 'float' | 'date' | 'currency';

function get(document: Document, type: ValueType = 'string', selector: string){
	let text: string;
	try {
		text = document.querySelector(selector)!.textContent!.replace(/\s\s+/g,  ' ').trim();
	} catch(e) {
		return undefined;
	}
	return toType(text, type);
}

function formatNumber(string: string){
	return String(string).replace(/\./g, '').replace(',', '.');
}

export function toType(val: any, type: ValueType){
	switch(type){
		case 'string': return String(val);
		case 'int': return toInt(val);
		case 'float': return toFloat(val);
		case 'date': return toDate(val);
		case 'currency': return toCurrency(val);
		default: return val;
	}
}

export function toDate(val: string){
	if(val === undefined || emptyValues.includes(val)) return undefined;
	const p = val.split('.');
	return new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]), 1);
}

export function toFloat(val: string){
	if(val === undefined || emptyValues.includes(val)) return undefined;
	return parseFloat(formatNumber(val));
}

export function toInt(val: string){
	return parseInt(formatNumber(val));
}

export function toCurrency(val: string){
	if(val === undefined || emptyValues.includes(val)) return undefined;
	return parseFloat(formatNumber(val.startsWith('EUR ') ? val.substr(4) : val));
}

export function toQueryString(obj?: any, prefix: string | false = '?', encodeKeys: boolean = true){
	if(!obj) return '';
	let r = Object.keys(obj)
		.map(key => obj[key] && (encodeKeys ? encodeURIComponent(key) : key) + '=' + encodeURIComponent(obj[key]))
		.filter(obj => obj)
		.join('&');
	return r && prefix ? prefix + r : r || '';
}

export function removeValues(obj: any, ...values: any[]){
	Object.keys(obj).forEach(key => ((!values.length && obj[key] === undefined) || values.includes(obj[key])) && delete obj[key]);
	return obj;
}

export function matchResult(regexp: RegExp, string: string, emptyValue: any = undefined){
	let res = regexp.exec(string);
	if(!res) return emptyValue;
	return res[1];
}

export {
	JSDOM,
	requestPromise
}