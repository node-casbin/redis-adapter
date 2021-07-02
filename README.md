node-casbin-redis-adapter

[![NPM version][npm-image]][npm-url]
[![NPM download][download-image]][download-url]
[![Coverage Status](https://coveralls.io/repos/github/node-casbin/redis-adapter/badge.svg?branch=master)](https://coveralls.io/github/node-casbin/sequelize-adapter?branch=master)
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/casbin/lobby)

[npm-image]: https://img.shields.io/npm/v/casbin-redis-adapter.svg?style=flat-square
[npm-url]: https://npmjs.org/package/casbin-redis-adapter
[download-image]: https://img.shields.io/npm/dm/casbin-redis-adapter.svg?style=flat-square
[download-url]: https://npmjs.org/package/casbin-redis-adapter

Redis policy storage, implemented as an adapter for [node-casbin](https://github.com/casbin/node-casbin).

Require it in a place, where you are instantiating an enforcer ([read more about enforcer here](https://github.com/casbin/node-casbin#get-started)):

```javascript

import { newEnforcer } from 'casbin';
import { NodeRedisAdapter }from './adapter' ;
import { join } from 'path';

const model=join(__dirname, 'casbin_conf/model.conf');
const adapter= await NodeRedisAdapter.newAdapter({host:"127.0.0.1",port:6379});
const enforcer = await newEnforcer(model,adapter);
 
 ```

That is all what required for integrating the adapter into casbin.

## Configuration

```NodeRedisAdapter.newAdapter()``` takes the following paramters as an object to establish the connection with redis-server
```javascript
host		:String
port		:Number
password	:String
// if remote server, it needs url
url			:String 
db			:Number
//If the connection is SSL Encrypted then TCL object
tcl			:Object
```
## License

[Apache-2.0](./LICENSE)
