node-casbin-redis-adapter
===
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

[Apache](./LICENSE)