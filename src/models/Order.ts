import {Api, Wikifolio, WikifolioOrdersParam} from '.'
import {parseHtml, removeValues, toFloat, toInt, toQueryString, toDate} from '../utils'
import { WebSocket } from'ws'
import { firstValueFrom, Subject } from '../../node_modules/rxjs/'

type OrderBuySell = 'buy' | 'sell'
type OrderType = 'limit' | 'stop' | 'quote'
type OrderSecurityType = 'TakeProfit' | 'StopLoss'

export interface OrderParam {
	amount: number
	limitPrice: number,
	orderType: OrderType,
	stopLossLimitPrice?: number,
	stopLossStopPrice?: number,
	stopPrice?: number,
	takeProfitLimitPrice?: number | null,
	underlyingIsin: string,
	expiresAt: Date | string
}

export interface OrderPlaceParam extends OrderParam {
	buysell: OrderBuySell
}

export class Order {
	private static instances: {[key: string]: Order} = {}
	public static instance(api: Api, wikifolio: Wikifolio, id: string): Order {
		return this.instances[id] = this.instances[id] || new Order({id}, wikifolio, api)
	}

	/**
	 * List orders of a wikifolio
	 */
	public static async list(api: Api, wikifolio: Wikifolio, param: Partial<WikifolioOrdersParam>): Promise<Order[]> {
		const {$, $$, string} = parseHtml(await api.request(
			`dynamic/${api.opt.locale.join('/')}/Publish/GetPagedOpenTrades${toQueryString({
				page: 0,
				pageSize: api.opt.defaults.pageSize,
				...param,
				id: wikifolio.id
			})}`
		))

		return [...$$('tr.parent-order.first-group-item')].map($tr => {
			const {dataset: {
				tradeAmount, orderBuysell, orderType, limit, stopLimit, description, validUntil,
				tpLimit, slLimit, slStop
			}} = $('.js-edit-trade-button', $tr)
			const group = $tr.dataset.group
			const isin = string('.isin', $tr)
			const expiresAt = toDate(validUntil)

			const order = Order.instance(api, wikifolio, $tr.dataset.id!)

			const children = $$(`.parent-order:not(.first-group-item)[data-group="${group}"]`).map($tr => {
				const {dataset} = $('.remove', $tr)
				const securityType = dataset.securityType as OrderSecurityType
				let stopPrice
				const prices = $('td.numeric div', $tr).innerHTML.split('/')

				if(securityType === 'StopLoss')
					stopPrice = toFloat(prices[0])

				return Order.instance(api, wikifolio, $tr.dataset.id!).set({
					group,
					parent: order,
					isin,
					description,
					status: $('.status-text', $tr).textContent!,
					stopPrice,
					securityType,
					expiresAt
				})
			})

			return order.set({
				group,
				isin,
				description,
				amount: toInt(tradeAmount),
				buysell: orderBuysell as OrderBuySell,
				orderType: orderType as OrderType,
				status: $('span.status-text', $tr).textContent!,
				limitPrice: toFloat(limit),
				stopPrice: toFloat(stopLimit),
				stopLossLimitPrice: toFloat(slLimit),
				stopLossStopPrice: toFloat(slStop),
				takeProfitLimitPrice: toFloat(tpLimit),
				expiresAt,
				children,
				sources: new Set<string>().add('wikifolio.orders')
			})
		})
	}

	children: Order[] = []
	sources = new Set<string>()
	parent?: Order

	id?: string
	group?: string
	isin?: string
	description?: string
	buysell?: OrderBuySell
	orderType?: OrderType
	securityType?: OrderSecurityType
	status?: string
	amount?: number

	limitPrice?: number 						// limit
	stopPrice?: number	  					// stop limit

	// TakeProfit
	takeProfitLimitPrice?: number   // limit

	// StopLoss
	stopLossStopPrice?: number			// stop limit
	stopLossLimitPrice?: number 		// limit

	createdAt?: Date
	// changedAt?: Date
	// executedAt?: Date
	expiresAt?: Date

	constructor(order: Partial<Order> = {}, public wikifolio: Wikifolio, public api: Api){
		this.set(order)
	}

	public set(order: Partial<Order>){
		return Object.assign(this, removeValues(order))
	}

	/**
	 * Place order
	 */
	public async submit(order: Partial<OrderPlaceParam>): Promise<this> {
		const res = await this.api.request({
			url: `${Api.url}api/virtualorder/placeorder`,
			method: 'post',
			json: removeValues({
				...this,
				...order,
				wikifolioId: this.wikifolio.id,
				validUntil: order.expiresAt instanceof Date ? order.expiresAt.toISOString() : order.expiresAt,
				quoteId: order.orderType === 'quote' ? await this.getQuoteId(order) : undefined
			})
		})

		const {success, orderGuid, reason} = res
		if(!success)
			throw new Error(`Unable to submit order (${reason||'n/a'})`)

		this.id = orderGuid

		return this
	}

	/**
	 * Remove order
	 */
	public async remove(){
		return await this.api.request({
			url: `${Api.url}dynamic/${this.api.opt.locale.join('/')}/publish/removevirtualorder`,
			method: 'post',
			json: {order: this.id}
		})
	}

	/**
	 * Returns the quoteId required to place an order of type 'quote'
	 */
	private async getQuoteId(order: Partial<OrderPlaceParam>) {
		var subject = new Subject<string>()

		const connectionTokenUrl = `${Api.url}de/de/signalr/negotiate?clientProtocol=1.5&connectionData=[{"name":"livehub"},{"name":"quotehub"}]&_=${new Date().getTime()}`
		let connectionToken = ''
		await this.api.request({
			url: connectionTokenUrl,
			method: 'get',
		}).then(data => connectionToken = JSON.parse(data)['ConnectionToken']);

		const websocketUrl = `wss://www.wikifolio.com/de/de/signalr/connect?transport=webSockets&clientProtocol=1.5&connectionToken=${encodeURIComponent(connectionToken)}&connectionData=[{"name":"livehub"},{"name":"quotehub"}]&tid=${Math.floor(Math.random() * 11)}`
		const ws = new WebSocket(websocketUrl, { headers: { 'Cookie': this.api.opt.cookie} })
		ws.on('open', () => {
			ws.send(`{"H":"quotehub","M":"GetQuote","A":[ "${this.wikifolio.id!}","${order.underlyingIsin}","${order.amount}",${order.buysell === 'buy' ? 910 : 920}],"I":4}`)
		})
		ws.on('message', (message) => {
			let msg = message.toString()
			let quoteIndex = msg.indexOf('QuoteId')
			if (quoteIndex !== -1) {
				let quoteId = msg.substring(quoteIndex+10, quoteIndex+46)
				subject.next(quoteId)
				subject.complete()
				ws.close()
			}
		})

		const startUrl = `${Api.url}/de/de/signalr/start?transport=webSockets&clientProtocol=1.5&connectionToken=${encodeURIComponent(connectionToken)}&connectionData=[{"name":"livehub"},{"name":"quotehub"}]&_=${new Date().getTime()}`
		this.api.request({
			url: startUrl,
			method: 'get',
		});

		return firstValueFrom<string>(subject.asObservable())
	}
}