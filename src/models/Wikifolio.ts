import {matchResult, parseHtml, removeValues, toCurrency, toDate, toFloat, toInt, toQueryString} from '../utils'
import {Api, Order, OrderParam, OrderPlaceParam, Portfolio, Trade, User} from '.'

export interface WikifolioIdentifier {
	id?: string;
	symbol?: string;
}

interface WikifolioParamCountry {
	country: string
	language: string
}

interface ParamPage {
	page: number
	pageSize: number
}

interface ParamCache {
	ignoreCache: boolean
}

export interface WikifolioOrdersParam extends ParamPage {}
interface WikifolioTradesParam extends ParamPage, WikifolioParamCountry {}
interface WikifolioAnalysisParam extends ParamCache, WikifolioParamCountry {}

type WikifolioSearchTag =
	// Anlageuniversum
	'aktde' | 'akteur' | 'akthot' | 'aktint' | 'etf' | 'anlagezert' | 'hebel'
	// Gehandelte Werte
	| 'schwer-d' | 'schwer-euro' | 'schwer-usa' | 'dividendenst' | 'ges-uni'
	// Handelsstil
	| 'regel' | 'divers' | 'heavy-T' | 'langf-st'
	// Qualitätsmerkmale
	| 'rising-star' | 'top-ten-t' | 'guter-ko' | 'regelm-akt' | 'bestseller' | 'treue-anl' | 'research'
	// Risiko/Rendite
	| 'high-perf' | 'money-man' | 'konti-wach'
	// Entscheidungsfindung
	| 'techanal' | 'fundamental' | 'sonstige'
	// Basiswährung
	| 'cureur' | 'curchf'

export interface WikifolioSearch {
	query: string
	tags: WikifolioSearchTag[]
	sortOrder: 'desc' | 'asc'
	sortBy: 'topwikis' | 'newestwiki' | 'firstem' | 'esgScore'
		| 'perfannually' | 'perfever' | 'perfemission' | 'perfytd' | 'perf12m' | 'perf6m' | 'perf3m' | 'perf1m'
		| 'sharperatio' | 'maxdraw' | 'aum' | 'buyint' | 'risk'
	startValue: number
	media: boolean
	private: boolean
	assetmanager: boolean
	theme: boolean
	super: boolean
	languageOnly: boolean
	investable: boolean
	realMoney: boolean
	savingplan: boolean
	LeverageProductsOnly: boolean
	WithoutLeverageProductsOnly: boolean

	perfever: string
	perfemission: string
	perfannually: string
	perfytd: string
	esgScore: string
	maxdraw: string
	aum: string
	risk: string

	perf12m: string
	perf6m: string
	perf3m: string
	perf1m: string
	sharperatio: string
	buyint: string
}

interface WikifolioComment {
	ref?: string
	html: string;
	text: string;
	createdAt: Date;
}

const regex = {
	script: /<script type="text\/json">(.*)<\/script>/g,
	wikifolioData: /wikifolio\.data = ({[^}]*})/g,
};

export class Wikifolio {
	private static instances: {[key: string]: Wikifolio} = {};
	public static instance(api: Api, identifier: WikifolioIdentifier | string): Wikifolio {
		const id = typeof identifier === 'string' ? Wikifolio.parseIdentifier(identifier) : identifier;
		const hash = JSON.stringify(id);
		return this.instances[hash] = this.instances[hash]
			|| new Wikifolio(id, api);
	}

	/**
	 * Transforms a string into an identifier object
	 */
	private static parseIdentifier(identifier: string): WikifolioIdentifier {
		switch(identifier.length){
			case 8: return {symbol: 'wf'+identifier};
			case 10: return {symbol: identifier};
			default: return {id: identifier};
		}
	}

	/**
	 * Returns a list of found Wikifolio[]
	 */
	public static async search(api: Api, param: Partial<WikifolioSearch> = {}): Promise<Wikifolio[]> {
		const html = await api.request(`dynamic/${api.opt.locale.join('/')}/wikifoliosearch/search${toQueryString({
			_: + new Date(),
			tags: ['aktde','akteur','aktusa','akthot','aktint','etf','fonds','anlagezert','hebel'],
			media: true,
			private: true,
			assetmanager: true,
			theme: true,
			super: true,
			...param
		})}`);

		let match: null | RegExpExecArray;
		const wikis: Wikifolio[] = [];

		do {
			match = regex.script.exec(html);
			if(!match) continue;
			const json = JSON.parse(match[1]);
			const {
				wikifolioFullName, isWatchlisted,
				mainRankingValue, status, tags,
				shortDescription: title, rankingValues, wikifolioUrl,
				chartImgUrl, wikifolioId, wikifolioIsin,
				editor
			} = json;
			let wiki: Wikifolio = new Wikifolio({symbol:wikifolioFullName}, api);
			const capital = rankingValues.find(i => i.label === 'Investiertes Kapital');
			const user = editor.name.split(' | ');
			wiki.set({
				capital: capital ? toCurrency(capital.displayValue) : 0,
				rank: toFloat(mainRankingValue.displayValue),
				tags: tags.map(t => t.text),
				id: wikifolioId,
				isin: wikifolioIsin || undefined,
				user: User.instance(api, user[1]).set({
					name:user[0],
					profileUrl:Api.url + editor.url.substr(1)
				}),
				createdAt: toDate(rankingValues.find(i => i.label === 'Erstellungsdatum').displayValue),
				publishedAt: toDate(rankingValues.find(i => i.label === 'Erstemission').displayValue),
				fee: toInt(rankingValues.find(i => i.label === 'Performancegebühr').displayValue),
				maxdraw: toFloat(rankingValues.find(i => i.label === 'Maximaler Verlust (bisher)').displayValue),
				perfever: toFloat(rankingValues.find(i => i.label === 'Performance seit Beginn').displayValue),
				perfannually: toFloat(rankingValues.find(i => i.label === 'Ø-Performance pro Jahr').displayValue),
				title,
				isWatchlisted,
				chartImgUrl,
				wikifolioUrl: Api.url + wikifolioUrl.substr(1),
				status: status
			});
			wikis.push(wiki);
		} while(match != null);

		return wikis;
	}

	/**
	 * Returns watchlisted Wikifolio[]
	 */
	public static async watchlist(api: Api) {
		const html = await api.request(`${api.opt.locale.join('/')}/watchlist/${api.opt.locale[0]==='de'?'bearbeiten':'edit'}`);

		let match = regex.script.exec(html);
		const wikis: Wikifolio[] = [];

		const {searchResults} = JSON.parse(match![1]);
		for(const item of searchResults){
			const {
				isNotificationSet,
				rankings,
				status,
				wikifolioId: id,
				wikifolioIsin: isin,
				shortDescription: title,
				chartImgUrl,
				wikifolioUrl,
				editor,
				rankingValues
			} = item;

			const symbol = wikifolioUrl.split('/').slice(-1)[0];
			let wikifolio: Wikifolio = new Wikifolio({symbol, id}, api);
			const user = editor.name.split(' | ');

			wikifolio.set({
				isin,
				title,
				user: User.instance(api, user[1]).set({
					name: user[0],
					profileUrl: Api.url + editor.url.substr(1)
				}),
				isNotificationSet,
				fee: toInt(rankingValues.find(i => i.label === 'Performancegebühr').displayValue),
				publishedAt: toDate(rankingValues.find(i => i.label === 'Erstemission').displayValue),
				createdAt: toDate(rankings.find(i => i.identifier === 'newestwiki').displayValue),
				rank: toFloat(rankings.find(i => i.identifier === 'topwikis').displayValue),
				buyint: toFloat(rankings.find(i => i.identifier === 'buyint').displayValue),
				bought30d: toFloat(rankings.find(i => i.identifier === 'bought30d').displayValue),
				perfever: toFloat(rankings.find(i => i.identifier === 'perfever').displayValue),
				perfemission: toFloat(rankings.find(i => i.identifier === 'perfemission').displayValue),
				perfytd: toFloat(rankings.find(i => i.identifier === 'perfytd').displayValue),
				capital: toCurrency(rankings.find(i => i.identifier === 'aum').displayValue),
				tradevol30d: toCurrency(rankings.find(i => i.identifier === 'tradevol30d').displayValue),
				perfbuy: toFloat(rankings.find(i => i.identifier === 'perfbuy').displayValue),
				perfannually: toFloat(rankings.find(i => i.identifier === 'perfannually').displayValue),
				perf60m: toFloat(rankings.find(i => i.identifier === 'perf60m').displayValue),
				perf36m: toFloat(rankings.find(i => i.identifier === 'perf36m').displayValue),
				perf12m: toFloat(rankings.find(i => i.identifier === 'perf12m').displayValue),
				perf52week: toFloat(rankings.find(i => i.identifier === 'perf52week').displayValue),
				perf6m: toFloat(rankings.find(i => i.identifier === 'perf6m').displayValue),
				perf3m: toFloat(rankings.find(i => i.identifier === 'perf3m').displayValue),
				perf1m: toFloat(rankings.find(i => i.identifier === 'perf1m').displayValue),
				maxdraw: toFloat(rankings.find(i => i.identifier === 'maxdraw').displayValue),
				sharperatio: toFloat(rankings.find(i => i.identifier === 'sharperatio').displayValue),
				esgScore: toFloat(rankings.find(i => i.identifier === 'esgScore').displayValue),
				risk: toFloat(rankings.find(i => i.identifier === 'risk').displayValue),
				chartImgUrl,
				wikifolioUrl: Api.url + wikifolioUrl.substr(1),
				status: status
			});
			wikis.push(wikifolio);
		}

		return wikis;
	}

	constructor(identifiers: WikifolioIdentifier, private api: Api){
		this.set(identifiers);
	}

	public set(wikifolio: Partial<Wikifolio>){
		return Object.assign(this, removeValues(wikifolio));
	}

	sources = new Set<string>();

	user?: User;

	id?: string;
	symbol?: string;

	wikifolioUrl?: string;
	isin?: string;
	wkn?: string;
	createdAt?: Date;
	publishedAt?: Date;

	status?: number;
	tags?: string[];

	capital?: number;
	title?: string;
	tradeidea?: string;
	highWatermark?: number;
	indexLevel?: number;
	fee?: number;
	liquidation?: number;
	tradingVolume?: number;

	decisionMaking?: string[];

	chartImgUrl?: string;
	investable?: boolean;
	containsLeverageProducts?: boolean;
	realMoney?: boolean;
	isWatchlisted?: boolean;
	name?: string;
	isOwned?: boolean;

	rank?: number; // Top-Wikifolio-Rangliste
	isSuper?: boolean; // isSuperWikifolio
	isChallenge?: boolean; // isChallengeWikifolio
	sharperatio?: number;

	perf12m?: number;
	perf6m?: number;
	perf3m?: number;
	perf1m?: number;

	perfever?: number;
	perfemission?: number;
	perfannually?: number;
	perfytd?: number;
	esgScore?: number;
	maxdraw?: number;
	aum?: number;
	risk?: number;

	perftoday?: number;
	perfintra?: number;

	perf52weekHigh?: number;

	// price
	ask?: number;
	bid?: number;
	quantityLimitBid?: number;
	quantityLimitAsk?: number;
	priceCalculatedAt?: Date;
	priceValidUntil?: Date;
	midPrice?: number;
	showMidPrice?: boolean;
	currency?: string;
	isCurrencyConverted?: boolean;
	isTicking?: boolean;

	// watchlist wikifolios
	isNotificationSet?: boolean;
	buyint?: number;
	bought30d?: number;
	perf36m?: number;
	perf60m?: number;
	perf52week?: number;
	tradevol30d?: number;
	perfbuy?: number;

	comments?: WikifolioComment[];

	// user wikifolios
	category?: string;

	/**
	 * Fetch specific attributes
	 */
	private async fetch(...attributes: string[]): Promise<this> {
		// remove loaded attributes
		attributes = attributes.filter(a => !this[a]);

		if(this.isOwned === undefined && attributes.includes('isOwned')){
			await this.details();
		}

		if(this.id === undefined && attributes.includes('id')){
			await this.basics();
		}

		if(attributes.includes('symbol')){
			// TODO: find a way to get the symbol with only the id provided
			throw new Error('Missing Wikifolio symbol');
		}

		return this;
	}

	/**
	 * Fetch basic data, mainly required for obtaining the ID when only a symbol is provided
	 */
	public async basics(ignoreCache: boolean = false): Promise<this> {
		if(this.sources.has('basics') && !ignoreCache) return this;
		await this.fetch('symbol');

		const {id, title, traderNickname, performanceEver, performanceToday} =
			await this.api.request(`api/wikifolio/${this.symbol}/basicdata`);

		this.sources.add('basics');

		return this.set({
			id, title,
			user: User.instance(this.api, traderNickname),
			perfever: toFloat(performanceEver.displayValue),
			perftoday: toFloat(performanceToday.displayValue)
		});
	}

	/**
	 * Fetches Wikifolio details from HTML (slow)
	 */
	public async details(ignoreCache: boolean = false): Promise<this> {
		if(this.sources.has('details') && !ignoreCache) return this;
		await this.fetch('symbol');

		const wikifolioUrl = `${this.api.opt.locale.join('/')}/w/${this.symbol}`;
		const {$, $$, attribute, string, float, date, currency} = parseHtml(
			await this.api.request(wikifolioUrl)
		);

		// on page js
		const {
			wikifolioId, userId, userOwnsWikifolio, isSuperWikifolio, isChallengeWikifolio, containsLeverageProducts
		} = eval(`(${regex.wikifolioData.exec($$('body script').slice(-1)[0].innerHTML)![1]})`);

		// the table contains no identifiers and changes depending on the wikifolio state -.-
		const table = $('table.c-certificate__key-table').innerHTML;
		const publishedAt = toDate(matchResult(/Erstemission<\/td>\s[^>]+>\s.+([0-9.]{10})/, table));
		const fee = parseInt(matchResult(/Performancegebühr<\/td>\s[^>]+>\s[ ]+([^ ]+)/, table));
		const liquidation = toFloat(matchResult(/Liquidationskennzahl<\/td>\s[^>]+>\s[ ]+([^ ]+)/, table));
		const tradingVolume = toCurrency(matchResult(/Handelsvolumen<\/td>\s.+\s.+\s[ ]+([^ ]+)/, table));

		const nickname = string('.c-trader__name:nth-child(2)');
		const user = User.instance(this.api, nickname);
		user.set({
			id: userId,
			name: string('.c-trader__name:nth-child(2)'),
			profileUrl: Api.url + attribute('.gtm-profile-link', 'href').substr(1)
		});

		this.set({
			user,
			id: wikifolioId,
			wikifolioUrl: Api.url + wikifolioUrl.substr(1),
			isin: string('.gtm-copy-isin'),
			title: string('.c-wf-head__title-text'),
			isOwned: userOwnsWikifolio,
			capital: currency('.c-certificate__item--capital .c-certificate__item-value'),
			createdAt: date('.c-masterdata__item:nth-child(2) .c-masterdata__item-value'),

			publishedAt,
			fee,
			liquidation,
			tradingVolume,

			indexLevel: float('.c-masterdata__item:nth-child(3) .c-masterdata__item-value'),
			highWatermark: float('.c-masterdata__item:nth-child(4) .c-masterdata__item-value'),

			perfever: float('.c-ranking-box--large .c-ranking-item:nth-child(1) .c-ranking-item__value'),
			perf12m: float('.c-ranking-box--large .c-ranking-item:nth-child(2) .c-ranking-item__value'),
			perfannually: float('.c-ranking-box--large .c-ranking-item:nth-child(3) .c-ranking-item__value'),
			maxdraw: float('.c-ranking-box--small .c-ranking-item__value'),
			risk: float('.c-risk-factor'),

			isSuper: isSuperWikifolio,
			isChallenge: isChallengeWikifolio,
			isWatchlisted: !!$('.js-remove-from-watchlist'),
			containsLeverageProducts,
			investable: !!$('.c-status-icon-wrapper[title*="Investierbar"]'),
			realMoney: !!$('.c-status-icon-wrapper[title*="Real Money"]'),

			tradeidea: string('.js-tradeidea__content'),
			decisionMaking: $$('.c-wfdecision__item').map(e => e.textContent!),

			comments: $$('.c-wfcomment article').map(e => {
				const body = e.querySelector('.c-wfcomment__item-content p')!;
				const d = String(e.querySelector('.c-wfcomment__item-date')!.textContent)
					.trim().split(/[. :]/g).map(n => parseInt(n));
				const ref = e.querySelector('.c-wfcomment__item-subheader-content');

				return removeValues({
					ref: ref ? String(ref.textContent).trim() : undefined,
					html: body.innerHTML,
					text: body.textContent,
					createdAt: new Date(d[2], d[1]-1, d[0], d[4]+2, d[5])
				})
			})
		});

		this.sources.add('details');

		return this;
	}

	/**
	 * Fetch wikifolio price
	 */
	public async price(ignoreCache: boolean = false): Promise<this> {
		if(this.sources.has('price') && !ignoreCache) return this;
		await this.fetch('id');

		const {
			ask, bid, quantityLimitBid, quantityLimitAsk, calculationDate, validUntilDate, midPrice,
			showMidPrice, currency, isCurrencyConverted, isTicking
		} = await this.api.request(`api/wikifolio/${this.id}/price`);

		this.set({
			ask, bid, quantityLimitBid, quantityLimitAsk, midPrice, showMidPrice, currency, isCurrencyConverted, isTicking,
			priceCalculatedAt: new Date(calculationDate),
			priceValidUntil: new Date(validUntilDate)
		});

		this.sources.add('price');

		return this;
	}

	/**
	 * Fetch portfolio
	 */
	public async portfolio(): Promise<Portfolio> {
		await this.fetch('symbol');

		const res = await this.api.request(
		`api/wikifolio/${this.symbol}/portfolio${toQueryString({
			country: this.api.opt.locale[0],
			language: this.api.opt.locale[1]
		})}`);

		this.isSuper = res.isSuperWikifolio;
		this.currency = res.currency;

		return new Portfolio({...res, isSuper: this.isSuper}, this);
	}

	/**
	 * Loads performance information
	 */
	public async analysis({ignoreCache, ...param}: Partial<WikifolioAnalysisParam> = {}): Promise<this> {
		if(this.sources.has('analysis') && !ignoreCache) return this;
		await this.fetch('id');

		const {analysis: {keyFigures: l}} = await this.api.request(
			`api/wikifolio/${this.id}/analysis${toQueryString({
				country: this.api.opt.locale[0],
				language: this.api.opt.locale[1],
				...param
			})}`
		);

		this.set({
			maxdraw: toFloat(l.find(i => i.label === 'Maximaler Verlust (bisher)').value),
			perf52weekHigh: toFloat(l.find(i => i.label == '52-Wochen-Hoch').value),
			sharperatio: toFloat(l.find(i => i.label === 'Sharpe Ratio').value),
			perfever: toFloat(l.find(i => i.label === 'Performance seit Beginn').value),
			perfemission: toFloat(l.find(i => i.label === 'Performance seit Emission').value),
			perfytd: toFloat(l.find(i => i.label === 'Performance seit Jahresbeginn').value),
			perfannually: toFloat(l.find(i => i.label === 'Ø-Performance pro Jahr').value),
			perf12m: toFloat(l.find(i => i.label === 'Performance 1 Jahr').value),
			perf6m: toFloat(l.find(i => i.label === 'Performance 6 Monate').value),
			perf3m: toFloat(l.find(i => i.label === 'Performance 3 Monate').value),
			perf1m: toFloat(l.find(i => i.label === 'Performance 1 Monat').value),
			perfintra: toFloat(l.find(i => i.label === 'Performance Intraday').value),
		});

		this.sources.add('analysis');

		return this;
	}

	/**
	 * Fetches Trade[] sorted by date
	 */
	public async trades(param: Partial<WikifolioTradesParam> = {}){
		await this.fetch('id');

		const {tradeHistory: {pageCount, isSuperWikifolio, orders}} =	await this.api.request(
			`api/wikifolio/${this.id}/tradehistory${toQueryString({
				page: 0,
				pageSize: this.api.opt.defaults.pageSize,
				country: this.api.opt.locale[0],
				language: this.api.opt.locale[1],
				...param
			})}`
		) as {tradeHistory: {pageCount: number, isSuperWikifolio: boolean, orders: any[]}};

		this.isSuper = isSuperWikifolio;
		const trades: Trade[] = orders.map(order => new Trade(removeValues(order, null), this));

		return {
			pageCount,
			trades
		}
	}

	// /**
	//  * Fetch sustainability
	//  */
	// public async sustainability(): Promise<void> {
	// 	console.error('Not yet implemented');
	// }

	/**
	 * Toggle watchlist status of wikifolio
	 */
	public async watchlist(add: boolean = true): Promise<boolean> {
		await this.fetch('id');

		const {success} = await this.api.request({
			url: `${Api.url}dynamic/en/int/watchlistwikifolio/${add?'addwikifoliotowatchlist':'removewikifoliofromwatchlist'}`,
			method: 'post',
			json: {wikifolioId: this.id}
		});

		return success;
	}

	/**
	 * Get order
	 */
	public order(id: string): Order {
		return Order.instance(this.api, this, id);
	}

	/**
	 * Returns open trades of a wikifolio
	 */
	public async orders(param: Partial<WikifolioOrdersParam> = {}){
		await this.fetch('id');
		return Order.list(this.api, this, param);
	}

	/**
	 * Place wikifolio order
	 */
	public async trade(order: Partial<OrderPlaceParam>): Promise<Order> {
		await this.fetch('id', 'isOwned');

		if(!this.isOwned)
			throw new Error('Can\'t place order in foreign wikifolio');

		return await new Order({}, this, this.api).submit(order);
	}

	/**
	 * Place a buy order
	 */
	public buy(order: Partial<OrderParam>): Promise<Order> {
		return this.trade({...order, buysell: 'buy'});
	}

	/**
	 * Place a sell order
	 */
	public sell(order: Partial<OrderParam>): Promise<Order> {
		return this.trade({...order, buysell: 'sell'});
	}
}