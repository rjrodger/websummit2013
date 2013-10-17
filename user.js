
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

