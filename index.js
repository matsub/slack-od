const { Datastore } = require('@google-cloud/datastore')
const datastore = new Datastore()


// weighted random
function chooseNiceone (entities) {
  const sum = entities.reduce((acm, cur) => acm + cur.nice, 0)
  let threashold = Math.random() * sum

  for (const entity of entities) {
    threashold -= entity.nice
    if (threashold <= 0) {
      return entity
    }
  }
}


function getUname (req) {
  return `<@${req.body.user_id}|${req.body.user_name}>`
}


async function enable (req) {
  const uname = getUname(req)

  // check if already registered
  const query = datastore
    .createQuery('opportunityDistributor')
    .filter('uname', '=', uname)
  const [entities] = await datastore.runQuery(query)

  if (entities.length > 0) {
    return `Already registered: ${uname}`
  }

  // register new user
  const key = datastore.key('opportunityDistributor')
  const entity = { key, data: { uname, nice: 10 } }

  await datastore.save(entity)

  return `Registered: ${uname}`
}


async function disable (req) {
  const uname = getUname(req)
  const query = datastore
    .createQuery('opportunityDistributor')
    .filter('uname', '=', uname)

  const [[entity]] = await datastore.runQuery(query)
  const key = entity[datastore.KEY]

  await datastore.delete(key)

  return `Unregistered: ${uname}`
}


async function increaseNice (entity) {
  const key = entity[datastore.KEY]

  if (entity.nice+1 < 40) {
    await datastore.update({
      key,
      data: { uname: entity.uname, nice: entity.nice+1 }
    })
  }

  return 'Acknowledged.'
}


async function decreaseNice (entity) {
  const key = entity[datastore.KEY]

  if (entity.nice-1 >= 0) {
    await datastore.update({
      key,
      data: { uname: entity.uname, nice: entity.nice-1 }
    })
  }

  return 'Acknowledged.'
}


async function nice (req) {
  const uname = req.body.text
  const query = datastore
    .createQuery('opportunityDistributor')
    .filter('uname', '=', uname)

  const [[entity]] = await datastore.runQuery(query)
  return decreaseNice(entity)
}


async function askme (req) {
  const uname = getUname(req)
  const query = datastore
    .createQuery('opportunityDistributor')
    .filter('uname', '=', uname)

  const [[entity]] = await datastore.runQuery(query)

  return increaseNice(entity)
}


// choose a nice one and forward the message
async function ask (req) {
  const message = req.body.text

  const query = datastore.createQuery('opportunityDistributor')
  const [entities] = await datastore.runQuery(query)

  const niceone = chooseNiceone(entities)

  for (const entity of entities) {
    if (entity.uname === niceone.uname) {
      decreaseNice(entity)
    } else {
      increaseNice(entity)
    }
  }

  return `${niceone.uname} ${message}`
}


function slashcommand (feature, response_type='ephemeral') {
  return async (req, res) => {
    const text = await feature(req)
    const msg = { response_type, text }

    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify(msg))
  }
}


exports.slashODEnable = slashcommand(enable, 'in_channel')
exports.slashODDisable = slashcommand(disable, 'in_channel')
exports.slashODNice = slashcommand(nice)
exports.slashODAskMe = slashcommand(askme)
exports.slashODAsk = slashcommand(ask)
