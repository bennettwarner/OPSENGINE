const Implant = require("../models/Implant");

/**
 * GET /implants
 */
exports.getImplants = (req, res) => {
  Implant.find({}, (err, implants) => {
    res.render("implant/implants", {
      title: "All Implants",
      implants: implants
    });
  });
};

/**
 * GET /implants/:id
 */
exports.userImplants = (req, res) => {
  Implant.find({ consultant: req.params.user }, (err, implants) => {
    res.render("implant/implants", {
      title: "My Implants",
      implants: implants
    });
  });
};

/**
 * GET /implant/:id
 */
exports.getImplant = (req, res, next) => {
  Implant.findOne({ _id: req.params.id }, (err, existingRecord) => {
    if (existingRecord) {
      var name = existingRecord.name;
      res.render("implant/implant", {
        title: name,
        implant: existingRecord
      });
    }
  });
};

/**
 * POST /implant/:id
 */
exports.postImplant = (req, res) => {};

/**
 * GET /shell/:id
 */
exports.getShell = (req, res) => {
  res.render("implant/shell", {
    title: "Shell"
  });
};

/**
 * POST /implants/add
 * Create a new local account.
 */
exports.addImplant = (req, res) => {
  var test_date = new Date("2014-04-03");
  const implant = new Implant({
    name: "Test Implant",
    status: {
      state: "Shipping",
      shipDate: test_date,
      returnDate: test_date,
      online: true,
      publicIP: "4.4.4.4"
    },
    model: "Intel NUC w/ WiFi",
    client: "NFL",
    location: "Patriot's Stadium",
    pointOfContact: {
      name: "John Smith",
      number: "123-123-123",
      email: "test@example.com"
    },
    consultant: "Ben",
    networkConfig: {
      internalIP: "192.168.1.10",
      subnet: "255.255.255.0",
      gateway: "192.168.1.1",
      dns1: "8.8.8.8",
      dns2: "8.8.4.4"
    },
    notes: "String"
  });

  implant.save(err => {
    console.log(err);
    res.redirect("/implants");
  });
};
