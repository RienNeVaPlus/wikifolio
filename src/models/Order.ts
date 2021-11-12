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
				quoteId: order.orderType === 'quote' ? await this.quoteId(order) : undefined
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
	async quoteId(order: Partial<OrderPlaceParam>) {
		const subject = new Subject<string>()
    const base: any = {
      connectionData: `[{"name":"livehub"},{"name":"quotehub"}]`
    }

    const {ConnectionToken} = JSON.parse(
      await this.api.request(`${this.api.opt.locale.join('/')}/signalr/negotiate`+toQueryString(base))
    )

    base.connectionToken = encodeURIComponent(ConnectionToken)
    base.transport = 'webSockets'

    const ws = new WebSocket(`wss://${Api.hostname}/de/de/signalr/connect`+toQueryString(base), {
      headers: { Cookie: this.api.opt.cookie }
    })

    ws.on('error', err => console.error(err))
    ws.on('open', () => ws.send(JSON.stringify({
        H: 'quotehub',
        M: 'GetQuote',
        A: [this.wikifolio.id, order.underlyingIsin, order.amount, order.buysell === 'buy' ? 910 : 920],
        I: 1
      }))
    )
		ws.on('message', message => {
      const res = JSON.parse(message.toString())
      if(!res.M || !res.M.length) return
      const {M: messages} = res

      for(const message of messages){
        const {H, M, A} = message
        if(H !== 'QuoteHub') continue

        switch(M) {
          default: console.warn('Unknown response from WebSocket:', H, M, A); break
          case 'quoteCallback': subject.next(A[0].QuoteId); break
          case 'quoteErrorCallback': throw new Error(A[0])
        }
        subject.complete()
        ws.close()
      }
		})

    this.api.request(`de/de/signalr/start${toQueryString(base)}`).then()

    return firstValueFrom<string>(subject.asObservable())
	}
}
