
require('seneca')()
  .add({user:'load'},             user_load)
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


