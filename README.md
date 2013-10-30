Web Summit 2013
===============

### Technical Debt Talk: example code


## Install

Clone the repository to get the code:

```sh
$ git clone https://github.com/rjrodger/websummit2013.git
```

(Or fork to your own github account)

Run [npm](http://npmjs.org) to install the [Seneca](http://senecajs.org) module:

```sh
$ cd websummit2013
$ npm install
```


## The _user_ Service

This service combines both user load and user login into one process.


```sh
$ node user.js
2013-10-30T09:04:37.315Z	INFO	hello	Seneca/0.5.13/qapas1
2013-10-30T09:04:37.521Z	INFO	plugin	transport	-	72avfh	listen	localhost	8000	/act	Seneca/0.5.13/qapas1
```

Then issue a request against the service, using _curl_ (or just open the URL in your browser):

```sh
$ curl "http://localhost:8000/act?user=login&name=alice&pass=123"
{"name":"alice","pass":"123"}
```

To get full logging from Seneca, so you can see in detail what's going on, use:

```sh
$ node user.js --seneca.log.all
...
```

The code for this service is:

```JavaScript
require('seneca')()
  .add({user:'load'},  user_load)
  .add({user:'login'}, user_login)
  .listen(8000)

var users = {
  alice: {name:'alice', pass:'123'},
  bob:   {name:'bob',   pass:'abc'},
}

function user_load(args, done){
  done(null,users[args.name])
}

function user_login(args, done){
  this.act({user:'load',name:args.name}, function(err,user){
    if( err || !user ) return done(err);
    if( user.pass == args.pass ) return done(null,user);
    return done();
  })
}
```

The users are stored as an in-memory map, and the passwords are in
plain-text.  Notice how the user_login action calls the user_load
action indirectly (this is simplified in the slides for the sake of
brevity).

The Seneca module is used to define two patterns,
<code>user=load</code> and <code>user=login</code>, and associate them
to functions that perform the actions required. Any message sent to
this service that matches one of the patterns will be
executed. There's no routing, or named end-points, or named remote
procedures - it's just about the content of the message.



## Splitting the Service

Seneca lets you defer scaling decision until later. This avoid the
early accumulation of technical debt by letting you make decisions
when you have more information.

In this case, you need to make passwords more secure by storing them
as hashes, not in plain text.  Hashing is CPU intensive (if you do it
right, which this example does not!), so you need to run the login
service in a separate process.

In this example, the _user_ service is split into two separate
services, one for loading users, _user_load_, and one for logging
users in, _user_login_. The deployment configuration is very simple -
each service delegates to the other if it gets a message it doesn't
understand.

Run the _user_load_ service:
```sh
$ node user_load.js
```

And run the _user_login_ service (in another terminal window):
```sh
$ node user_login.js
```

And then you can issue requests against either service. For example, you can load users from either:

```sh
$ curl "http://localhost:8001/act?user=load&name=alice"
{"name":"alice","pass":"202cb962ac59075b964b07152d234b70"}

$ curl "http://localhost:8002/act?user=load&name=alice"
{"name":"alice","pass":"202cb962ac59075b964b07152d234b70"}
```

And you can login from either:

```sh
$ curl "http://localhost:8001/act?user=login&name=alice&pass=123"
{"name":"alice","pass":"202cb962ac59075b964b07152d234b70"}

$ curl "http://localhost:8002/act?user=login&name=alice&pass=123"
{"name":"alice","pass":"202cb962ac59075b964b07152d234b70"}
```


The code for the _user_load_ service is:

```JavaScript
require('seneca')()
  .add({user:'load'},  user_load)
  .listen(8001)
  .proxy(8002)

var users = {
  alice: {name:'alice', pass:'202cb962ac59075b964b07152d234b70'},
  bob:   {name:'bob',   pass:'900150983cd24fb0d6963f7d28e17f72'},
}

function user_load(args, done){
  done(null,users[args.name])
}
```

Only the load function is defined in this service. The user data
remains here.  In addition to listening on port 8001, this service
also proxies unrecognized messages to 8002, which is where you run the
_user_login_ service:

```JavaScript
require('seneca')()
  .add({user:'login'}, user_login)
  .listen(8002)
  .proxy(8001)

function user_login(args, done){
  this.act({user:'load',name:args.name}, function(err,user){
    if( err || !user ) return done(err);

    var hash = require('crypto')
          .createHash('md5')
          .update( args.pass, 'utf8' )
          .digest('hex')

    if( user.pass == hash ) return done(null,user);
    return done();
  })
}
```

This version of the login service uses hashing to verify the
passwords. You can also see the the listen and proxy port numbers are
inverted compared to the load service. This enables both services to
work together to answer all requests.



## Scaling the Service

The HTTP ports are hard-coded in the previous example, but you could
use something like [seaport](https://github.com/substack/seaport) or
[ZooKeeper](http://zookeeper.apache.org/) to run many instances of the
services and distribute load.

A simplistic approach is to use the
[cluster](http://nodejs.org/api/cluster.html) facility built into
Node.js.

Seneca makes this easy by providing the cluster utility method:

```JavaScript
require('seneca')()
  .cluster()
  .add({user:'login'}, user_login)
  .listen(8002)
  .proxy(8001)

function user_login(args, done){
  this.act({user:'load',name:args.name,group:args.group}, function(err,user){
    if( err || !user ) return done(err);

    var hash = require('crypto')
          .createHash('md5')
          .update( args.pass, 'utf8' )
          .digest('hex')

    if( user.pass == hash ) return done(null,user);
    return done();
  })
}

Run this with:
```sh
$ node user_login_cluster.js
```

You can access the service in the same manner as before:

```sh
$ curl "http://localhost:8001/act?user=login&name=alice&pass=123"
{"name":"alice","pass":"202cb962ac59075b964b07152d234b70"}

$ curl "http://localhost:8002/act?user=login&name=alice&pass=123"
{"name":"alice","pass":"202cb962ac59075b964b07152d234b70"}
```


If you look at your process list:
```sh
$ ps -ef | grep node
  501 24833 24585   0   0:00.06 ttys004    0:00.45 node user_load.js
  501 24838 24634   0   0:00.00 ttys005    0:00.00 grep node
  501 24828 24675   0   0:00.05 ttys006    0:00.31 node user_login_cluster.js
  501 24829 24828   0   0:00.08 ttys006    0:00.71 node user_login_cluster.js
  501 24830 24828   0   0:00.09 ttys006    0:00.71 node user_login_cluster.js
  501 24831 24828   0   0:00.08 ttys006    0:00.70 node user_login_cluster.js
  501 24832 24828   0   0:00.08 ttys006    0:00.73 node user_login_cluster.js
```

You'll see four additional processes for the _user_login_cluster_
service. The Node.js cluster module looks after distributing work to
each of these for you.


## Extending the Service

The other thing that pattern matching makes much easier is adding
features down the road. Imagine in this example that you need to
support groups of users. The users within each group are unique only
to that group. You'd like to keep the old functionality as well.

This is done by pattern matching against a _group_ property, as well
as the _user_ property. Here's the code:

```JavaScript
require('seneca')()
  .add({user:'load'},              user_load)
  .add({user:'load', group:'red'}, user_load_red)
  .listen(8001)
  .proxy(8002)

var users = {
  alice: {name:'alice', pass:'202cb962ac59075b964b07152d234b70'},
}

var red_users = {
  alice: {name:'alice', pass:'900150983cd24fb0d6963f7d28e17f72'},
}

function user_load(args, done){
  done(null,users[args.name])
}

function user_load_red(args, done){
  done(null,red_users[args.name])
}
```

Run this with:

```sh
node user_load_group.js
```

Note that you don't need to shutdown the login service - you can leave
that alone!  Just kill and restart the load service. This ability to
deploy at a fine-grained level makes your life a lot easier. It
enables you to, for example, partially role out new functionality to
test it and make sure it doesn't break anything.

Executing commands against this new service gives:

```sh
$ curl "http://localhost:8001/act?user=load&name=alice&group=red"
{"name":"alice","pass":"900150983cd24fb0d6963f7d28e17f72"}

$ curl "http://localhost:8001/act?user=load&name=alice"
{"name":"alice","pass":"202cb962ac59075b964b07152d234b70"}
```

You can see that the _group_ propery gives a match against the new function.

This will also work against the login service - it just passes through
the group property.


## More Information

For more examples, and documentation, visit the (Seneca)[http://senecajs.org] site.

If you're trying out these examples, feel free to contact me on Twitter if you
have any questions! :) [@rjrodger](http://twitter.com/rjrodger)



