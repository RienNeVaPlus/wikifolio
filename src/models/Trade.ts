import {Api, Wikifolio} from '.'
import {removeValues} from '../utils';

type TradeOrderTypeSell = 'Sell' | 'SellLimit' | 'StopLoss' | 'SellStopLimit'
type TradeOrderTypeBuy = 'Buy' | 'BuyLimit'
type TradeOrderType = TradeOrderTypeBuy | TradeOrderTypeSell

export class Trade {
	id?: string;
	type?: 'buy' | 'sell';
	orderType?: TradeOrderType;
	name?: string;
	isin?: string;
	link?: string;
	isMainOrder?: boolean;
	mainOrderId?: string;
	subOrders?: any[];
	issuer?: number;
	securityType?: number;
	executionDate?: string;
	executedAt?: Date;
	performance?: number;
	weightage?: number;
	investmentUniverseGroupId?: string;
	isLeveraged?: boolean;
	linkParameter?: string;
	corporateActionType?: any;
	cash?: any;

	private static getType(orderType: TradeOrderType): 'buy' | 'sell' {
		return ['Buy', 'BuyLimit'].includes(orderType) ? 'buy' : 'sell';
	}

	constructor(trade: Partial<Trade> = {}, public wikifolio: Wikifolio){
		this.set({
			...trade,
			type: Trade.getType(trade.orderType!),
			link: Api.url + trade.link!.substr(1),
			executedAt: new Date(trade.executionDate!)
		});
	}

	public set(trade: Partial<Trade>){
		return Object.assign(this, removeValues(trade));
	}
}