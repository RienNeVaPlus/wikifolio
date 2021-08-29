<h1 align="center">
  📊 Wikifolio API
</h1>

<p align="center">
    <a href="https://github.com/RienNeVaPlus/wikifolio/commits/master"><img src="https://img.shields.io/github/last-commit/riennevaplus/wikifolio.svg" /></a>
    <a href="https://github.com/RienNeVaPlus/wikifolio/blob/master/package.json"><img src="https://img.shields.io/github/package-json/v/riennevaplus/wikifolio.svg" /></a>
    <a href="https://www.npmjs.com/package/wikifolio"><img src="https://img.shields.io/npm/v/wikifolio.svg" /></a>
    <a href="https://github.com/RienNeVaPlus/wikifolio/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/wikifolio.svg" /></a>
    <img src="https://img.shields.io/github/repo-size/RienNeVaPlus/wikifolio.svg" />
</p>

<p align="center">
This is an <strong>unofficial</strong> Node.js API client for <a href="https://www.wikifolio.com">Wikifolio's platform</a>.
</p>

<p align="center">
    <sub>
        ⚠️ <strong>Wikifolio could change their API at any moment.</strong> ⚠️
        <br/>
        If anything is broken, please <a href="https://github.com/RienNeVaPlus/wikifolio/issues/new/choose">open an issue</a>.
     </sub>
</p>

![divider](./assets/divider.png)

### ⭐ Features
- **Session management**
- **Search wikifolios**
- Fetch wikifolio **details** / **analysis** / **price**
- Fetch **portfolio positions**
- Fetch wikifolio **trades**
- Fetch **watchlist entries**
- **Watch** / **unwatch** wikifolios
- Fetch **users** & their **wikifolios**
- **Trading**: place & modify **buy** & **sell orders**

![divider](./assets/divider.small.png)

🌞 **Contributors wanted**

![divider](./assets/divider.png)

### 🛫 Install

```bash
# using npm
npm i wikifolio

# using yarn
yarn add wikifolio
```

![divider](./assets/divider.png)

### 📝 Examples

The examples assume the following setup:

```ts
import Api from 'wikifolio'

const api = new Api({email: 'example@riennevaplus.de', password: 'examplepassword1337'})
```

![divider](./assets/divider.small.png)

#### 1. Fetch details of a wikifolio

```ts
const wikifolio = api.wikifolio('wfobserver')
console.log( await wikifolio.details() )
```

![divider](./assets/divider.small.png)

#### 2. Fetch wikifolio price

```ts
const wikifolio = api.wikifolio('wfobserver')
console.log( await wikifolio.price() )
```

![divider](./assets/divider.small.png)

#### 3. Fetch wikifolio trades

```ts
const wikifolio = api.wikifolio('wfobserver')
console.log( await wikifolio.trades({pageSize: 100, page: 1}) )
```

![divider](./assets/divider.small.png)

#### 4. Fetch wikifolio index history (chart)

```ts
const wikifolio = api.wikifolio('wfobserver')
console.log( await wikifolio.history() )
```

![divider](./assets/divider.small.png)

#### 5. Fetch portfolio items of a wikifolio

```ts
const wikifolio = api.wikifolio('wfobserver')
console.log( await wikifolio.portfolio() )
```

![divider](./assets/divider.small.png)

#### 6. Search wikifolios

```ts
const wikifolios = await api.search({query: 'Supervisor'})
console.log( wikifolios )
```

![divider](./assets/divider.small.png)

#### 7. Unwatch all wikifolios on the watchlist

```ts
const watchlist = await api.watchlist()
for(const wikifolio of watchlist){
    await wikifolio.watchlist(false)
}
```

![divider](./assets/divider.small.png)

#### 8. Get trader info

```ts
const user = api.user('riennevaplus')
console.log( await user.details() )
```

![divider](./assets/divider.small.png)

#### 9. Get wikifolios of a trader

```ts
const user = api.user('riennevaplus')
console.log( await user.wikifolios() )
```

![divider](./assets/divider.small.png)

#### 10. Place a buy order

There's a similar `sell()` method.

```ts
const wikifolio = api.wikifolio('wfobserver')
const result = await wikifolio.buy({
    amount: 1,
    limitPrice: 220,
    orderType: "limit",
    underlyingIsin: "DE000LS9NMQ9",
    validUntil: "2020-07-29T00:00:00.000Z"
})
```

![divider](./assets/divider.small.png)

#### 11. Update an order

```ts
const wikifolio = api.wikifolio('wfobserver')
const order = wikifolio.order('8b4da005-6750-4b4c-9dff-0364d3e07be0')
console.log( await order.submit({limitPrice: 100}) )
```

![divider](./assets/divider.small.png)

#### 12. List & remove wikifolio orders

```ts
const wikifolio = api.wikifolio('wfobserver')
const orders = await wikifolio.orders({pageSize: 25, page: 0})

for(const order of orders){
    console.log( await order.remove() )
}
```

![divider](./assets/divider.png)

### 👷 Todos
- Improve documentation
- Implement wikifolio sustainability

![divider](./assets/divider.png)

### 🌻 Contributors
* [RienNeVaPlus](https://github.com/riennevaplus)
* You? 💚
