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
- Fetch **portfolio items**
- Fetch wikifolio **trades**
- Fetch **watchlist entries**
- **Watch** / **unwatch** wikifolios

![divider](./assets/divider.small.png)

🌞 **This repo is in active development and will receive additional features.** Contributors wanted 🙋

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
import {Wikifolio} from 'wikifolio'

const wiki = new Wikifolio({email, password});
```

![divider](./assets/divider.small.png)

#### 1. Fetch details of a wikifolio

```ts
const wikifolio = wiki.wikifolio('wfobserver');
console.log(await wikifolio.details());
```

![divider](./assets/divider.small.png)

#### 2. Fetch wikifolio price

```ts
const wikifolio = wiki.wikifolio('wfobserver');
console.log(await wikifolio.price());
```

![divider](./assets/divider.small.png)

#### 3. Fetch wikifolio trades

```ts
const wikifolio = wiki.wikifolio('wfobserver');
console.log(await wikifolio.trades({pageSize:100, page:1}));
```

![divider](./assets/divider.small.png)

#### 4. Fetch portfolio items of a wikifolio

```ts
const wikifolio = wiki.wikifolio('wfobserver');
console.log(await wikifolio.portfolio());
```

![divider](./assets/divider.small.png)

#### 5. Search wikifolios

```ts
const wikifolios = await wiki.search({query: 'Supervisor'});
console.log(wikifolios);
```

![divider](./assets/divider.small.png)

#### 6. Unwatch all wikifolios on the watchlist

```ts
const watchlist = await wiki.watchlist();
for(const wikifolio of watchlist){
    await wikifolio.watchlist(false);
}
```

![divider](./assets/divider.small.png)

#### 7. Get trader info

```ts
const user = wiki.user('riennevaplus');
console.log(await user.details()); 
```

![divider](./assets/divider.small.png)

#### 8. Get wikifolios of a trader

```ts
const user = wiki.user('riennevaplus');
console.log(await user.wikifolios()); 
```

![divider](./assets/divider.png)

### 👷 Todos
- Improve documentation
- Implement trading features for own wikifolios
- Implement wikifolio sustanability

![divider](./assets/divider.png)

### 🌻 Contributors
* [RienNeVaPlus](https://github.com/riennevaplus)
* You? 💚