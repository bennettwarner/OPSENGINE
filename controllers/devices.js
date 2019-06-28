const Device = require('../models/Device');

/**
 * GET /devices
 */
exports.getDevices = (req, res) => {
  Device.find({}, (err, devices) => {
    console.log(devices);
    res.render('device/devices', {
      title: 'All Devices',
      devices: devices
    });
  });
};

/**
 * GET /devices/:id
 */
exports.userDevices = (req, res) => {
  Device.find({ consultant: req.params.user }, (err, devices) => {
    console.log(devices);
    res.render('device/devices', {
      title: 'My Devices',
      devices: devices
    });
  });
};


/**
 * GET /device/:id
 */
exports.getDevice = (req, res, next) => {
  Device.findOne({ _id: req.params.id }, (err, existingRecord) => {
    if (existingRecord){
    console.log(existingRecord);
    var name = existingRecord.name;
    res.render('device/device', {
      title: name,
      device: existingRecord,
    });

}})};


/**
 * POST /device/:id
 */
exports.postDevice = (req, res) => {
};


/**
 * GET /shell/:id
 */
exports.getShell = (req, res) => {
    res.render('device/shell', {
      title: 'Shell',
  });
};

/**
 * POST /devices/add
 * Create a new local account.
 */
exports.addDevice = (req, res) => {
  var test_date = new Date('2014-04-03');
  const device = new Device({
    name: 'Test Device',
    status: {
        state: 'Shipping',
        shipDate: test_date,
        returnDate: test_date,
        online: true,
        publicIP: '4.4.4.4',
    },
    model: 'Intel NUC w/ WiFi',
    client: 'NFL',
    location: 'Patriot\'s Stadium',
    pointOfContact: {
      name: 'John Smith',
      number: '123-123-123',
      email: 'test@example.com',
    },
    consultant: 'Ben',
    networkConfig: {
      internalIP: '192.168.1.10',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      dns1: '8.8.8.8',
      dns2: '8.8.4.4',
    },
    notes: 'String',
  });
  
  device.save((err) => {
    res.redirect('/devices');
      });
};
