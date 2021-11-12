import {JSDOM} from 'jsdom'
import got from 'got'

const emptyValues = ['', '-', 'N/A']

type Node = Document | HTMLElement

export function parseHtml(html: string){
  const {window} = new JSDOM(html)
  const {document} = window
  return {html, window, document,
    $: (selector: string, parent: Node = document) => parent.querySelector(selector) as HTMLElement,
    $$: (selector: string, parent: Node  = document) => Array.from(parent.querySelectorAll(selector)) as HTMLElement[],
    attribute: (selector: string, attr: string) => { return document.querySelector(selector)![attr] },
    string: get.bind(null, document, 'string'),
    int: get.bind(null, document, 'int'),
    float: get.bind(null, document, 'float'),
    date: get.bind(null, document, 'date'),
    currency: get.bind(null, document, 'currency')
  }
}

type ValueType = 'string' | 'int' | 'float' | 'date' | 'currency'

function get(document: Document, type: ValueType = 'string', selector: string, parent?: HTMLElement){
  let text: string
  try {
    text = (parent||document).querySelector(selector)!.textContent!.replace(/\s\s+/g,  ' ').trim()
  } catch(e) {
    return undefined
  }
  return toType(text, type)
}

function formatNumber(string: string){
  return String(string).replace(/\./g, '').replace(',', '.')
}

export function toType(val: any, type: ValueType){
  switch(type){
    case 'string': return String(val).trim()
    case 'int': return toInt(val)
    case 'float': return toFloat(val)
    case 'date': return toDate(val)
    case 'currency': return toCurrency(val)
    default: return val
  }
}

export function toDate(val?: string) {
  if(val === undefined || emptyValues.includes(val)) return undefined
  let p
  if(val.includes('T')){
    return new Date(
      parseInt(val.substr(0,4)),
      parseInt(val.substr(4, 2))-1,
      parseInt(val.substr(6, 2)),
      parseInt(val.substr(9, 2)),
      parseInt(val.substr(11, 2))
    )
  }
  if(val.includes('.')){
    p = val.split('.')
    return new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]), 1)
  }
  return undefined
}

export function fromDate(d: Date, type?: string){
  switch(type) {
    default:
      const [date, month] = [d.getDate(), d.getMonth()+1]
      return (date < 10 ? '0' : '') + date + '.' + (month < 10 ? '0' : '') + month + '.' + d.getFullYear()
  }
}

export function toFloat(val?: string){
  if(val === undefined || emptyValues.includes(val)) return undefined
  return parseFloat(formatNumber(val))
}

export function toInt(val?: string){
  if(val === undefined) return undefined
  return parseInt(formatNumber(val))
}

export function toCurrency(val: string){
  if(val === undefined || emptyValues.includes(val)) return undefined
  return parseFloat(formatNumber(val.startsWith('EUR ') ? val.substr(4) : val))
}

export function toQueryString(obj?: any, prefix: string | false = '?', encode: 'keys' | 'values' | 'all' | 'none' = 'none'){
  if(!obj) return ''
  let r = Object.keys(obj)
    .map(key => obj[key] &&
        (['all', 'keys'].includes(encode) ? encodeURIComponent(key) : key)
      + '='
      + (['all', 'values'].includes(encode) ? encodeURIComponent(obj[key]) : obj[key])
    )
    .filter(obj => obj)
    .join('&')
  return r && prefix ? prefix + r : r || ''
}

export function removeValues(obj: any, ...values: any[]){
  Object.keys(obj).forEach(key => ((!values.length && obj[key] === undefined) || values.includes(obj[key])) && delete obj[key])
  return obj
}

export function matchResult(regexp: RegExp, string: string, emptyValue: any = undefined){
  const res = regexp.exec(string)
  if(!res) return emptyValue
  return res[1]
}

export { JSDOM, got }
