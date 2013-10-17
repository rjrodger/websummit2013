

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


