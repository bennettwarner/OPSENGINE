const User = require("../models/User");
const Server = require("../models/Server");

const fs = require("fs");
const scp = require("scp2");
const Client = require("ssh2").Client;
const axios = require("axios");
const api = axios.create({ baseURL: "https://api.digitalocean.com/v2/" });
api_key = process.env.DO_APIKEY;
var config = {
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + api_key
  }
};

var generator = require("generate-password");

exports.getInfrastructure = (req, res, next) => {
  Server.find({}, (err, servers) => {
    User.find({}, (err, users) => {
      api
        .get("droplets?per_page=100", config)
        .then(response => {
          console.log(response.data.droplets);
          droplets = [];
          for (x in response.data.droplets) {
            if (
              response.data.droplets[x].tags[0] == process.env.DO_SERVERTAG ||
              response.data.droplets[x].tags[0] == "vpngateway"
            ) {
              droplets.push(response.data.droplets[x]);
              console.log(response.data.droplets[x]);
            }
          }
          res.render("infrastructure/infrastructure", {
            title: "Infrastructure",
            infrastructure: droplets,
            users: users,
            servers: servers
          });
        })
        .catch(error => {
          console.log(error);
        });
    });
  });
};

exports.getdeployInfrastructure = (req, res, next) => {
  api
    .get("images?private=true", config)
    .then(response => {
      all_images = response.data.images;
      images = [];
      for (x in all_images) {
        if (
          all_images[x].type == "snapshot" &&
          all_images[x].name != "vpngateway-1911"
        ) {
          images.push(all_images[x]);
          console.log(all_images[x]);
        }
      }
      res.render("infrastructure/create", {
        title: "Deploy Server",
        images: images
      });
    })
    .catch(error => {
      console.log(error);
    });
};

exports.postdeployInfrastructure = (req, res, next) => {
  var password =
    process.env.PLATFORM +
    generator.generate({
      length: 8,
      numbers: true
    });
  name = req.body.name.replace(/\W/g, "");
  api
    .post(
      "droplets",
      {
        name: name,
        region: req.body.location,
        size: process.env.DO_SERVERSIZE,
        image: req.body.image,
        backups: false,
        ipv6: false,
        user_data:
          `#!/bin/bash
        sudo echo -e "` +
          password +
          "\n" +
          password +
          `" | passwd root`,
        private_networking: null,
        volumes: null,
        tags: [process.env.DO_SERVERTAG]
      },
      config
    )
    .then(response => {
      server_id = response.data.droplet.id;
      setTimeout(function() {
        api
          .get("droplets/" + server_id, config)
          .then(response2 => {
            const server = new Server({
              id: response2.data.droplet.id,
              ip: response2.data.droplet.networks.v4[1].ip_address,
              name: name,
              consultant: req.user._id,
              creds: password,
              type: "standard"
            });
            server.save(err => {
              console.log(response2.data.droplet);
              res.render("infrastructure/createSuccess", {
                title: "Deploy Infrastructure",
                name: name,
                password: password,
                ip: response2.data.droplet.networks.v4,
                id: response2.data.droplet.id
              });
            });
          })
          .catch(error => {
            console.log(error);
          });
      }, 5000);
    })
    .catch(error => {
      console.log(error);
    });
};
exports.getdeployGateway = (req, res, next) => {
  res.render("infrastructure/createGateway", {
    title: "Deploy Gateway"
  });
};
exports.postdeployGateway = (req, res, next) => {
  var password =
    process.env.PLATFORM +
    generator.generate({
      length: 8,
      numbers: true
    });
  name = req.body.name.replace(/\W/g, "");
  api
    .post(
      "droplets",
      {
        name: name,
        region: req.body.location,
        size: "s-1vcpu-2gb",
        image: "55279322",
        backups: false,
        ipv6: false,
        user_data:
          `#!/bin/bash
        sudo echo -e "` +
          password +
          "\n" +
          password +
          `" | passwd root
          sudo bash /root/vpn.sh
          `,
        private_networking: null,
        volumes: null,
        tags: ["vpngateway"]
      },
      config
    )
    .then(response => {
      server_id = response.data.droplet.id;
      setTimeout(function() {
        api
          .get("droplets/" + server_id, config)
          .then(response2 => {
            const server = new Server({
              id: response2.data.droplet.id,
              ip: response2.data.droplet.networks.v4[1].ip_address,
              name: name,
              consultant: req.user._id,
              creds: password,
              type: "gateway"
            });
            server.save(err => {
              console.log(response2.data.droplet);
              res.render("infrastructure/createGatewaySuccess", {
                title: "VPN Deployed",
                name: name
              });
            });
          })
          .catch(error => {
            console.log(error);
          });
      }, 5000);
    })
    .catch(error => {
      console.log(error);
    });
};

exports.rdpgen = (req, res, next) => {
  ip = req.params.id;
  res.set("Content-Disposition", "attachment;filename=server.rdp");
  res.send("full address:s:" + ip + ":1337");
};

exports.deleteServer = (req, res, next) => {
  api
    .delete("droplets/" + req.params.id, config)
    .then(response => {
      Server.remove({ id: req.params.id }, (err, user) => {
        if (err) {
          return next(err);
        }
        console.log(response.data);
        res.redirect("/infrastructure");
      });
    })
    .catch(error => {
      console.log(error);
    });
};

/**
 * GET /shell/:id
 */
exports.getShell = (req, res) => {
  Server.findOne({ id: req.params.id }, (err, server) => {
    if (err) {
      return next(err);
    }
    console.log(server);
    res.render("infrastructure/shell", {
      title: "Shell",
      server: server,
      sshtun: process.env.SSHTUN_BASEURL
    });
  });
};

/**
 * GET /files/:id
 */
exports.getFiles = (req, res) => {
  Server.findOne({ id: req.params.id }, (err, server) => {
    if (err) {
      return next(err);
    }
    directory = process.env.FILEMANAGER_PATH;
    if (req.query.path) {
      directory += req.query.path + "/";
    }
    console.log(server);
    var conn = new Client();
    conn
      .on("ready", function() {
        conn.sftp(function(err, sftp) {
          if (err) throw err;
          sftp.readdir(directory, function(err, list) {
            if (err) throw err;
            if (req.query.path) {
              current_dir = req.query.path + "/";
            } else {
              current_dir = "";
            }
            res.render("infrastructure/files", {
              title: "Files",
              server: server,
              dir: list,
              path: directory,
              current_dir: current_dir
            });
            conn.end();
          });
        });
      })
      .connect({
        host: server.ip,
        port: 22,
        username: "root",
        password: server.creds
      });
  });
};

exports.dlFile = (req, res) => {
  Server.findOne({ id: req.params.id }, (err, server) => {
    if (err) {
      return next(err);
    }
    pathArray = req.query.file.split("/");
    file = pathArray.pop();
    scp.scp(
      {
        host: server.ip,
        username: "root",
        password: server.creds,
        path: file
      },
      "./tmp/" + file,
      function(err) {
        res.set("Content-Disposition", "attachment;filename=" + file);
        res.sendFile(
          __dirname.substr(0, __dirname.length - 12) + "/tmp/" + file
        );
        setTimeout(function() {
          fs.unlink("./tmp/" + file, function(err) {
            if (err) throw err;
            // if no error, file has been deleted successfully
            console.log("File deleted!");
          });
        }, 60000);
      }
    );
    console.log(server);
  });
};

/**
 * POST /serverMetadata/:id
 * Update profile information.
 */
exports.postMetadata = (req, res, next) => {
  Server.findOne({ id: req.params.id }, (err, server) => {
    if (err) {
      return next(err);
    }
    console.dir(req.body);
    server.consultant = req.body.consultant || "";
    server.client = req.body.client || "";
    server.project.start = req.body.start || "";
    server.project.end = req.body.end || "";
    server.notes = req.body.notes || "";

    server.save(err => {
      if (err) {
        return next(err);
      }
      req.flash("success", { msg: "Server metadata has been updated." });
      res.redirect("/infrastructure");
    });
  });
};

exports.getUserInfrastructure = (req, res, next) => {
  Server.find({}, (err, servers) => {
    User.find({}, (err, users) => {
      api
        .get("droplets?per_page=100", config)
        .then(response => {
          console.log(response.data.droplets);
          droplets = [];
          for (x in response.data.droplets) {
            if (
              response.data.droplets[x].tags[0] == process.env.DO_SERVERTAG ||
              response.data.droplets[x].tags[0] == "vpngateway"
            ) {
              droplets.push(response.data.droplets[x]);
              console.log(response.data.droplets[x]);
            }
          }
          res.render("infrastructure/userInfrastructure", {
            title: "Infrastructure",
            infrastructure: droplets,
            users: users,
            servers: servers
          });
        })
        .catch(error => {
          console.log(error);
        });
    });
  });
};

exports.getServer = (req, res, next) => {
  Server.findOne({ id: req.params.id }, (err, server) => {
    console.log(server);
    User.find({}, (err, users) => {
      api
        .get("droplets/" + server.id, config)
        .then(response => {
          console.log(response.data);
          res.render("infrastructure/server", {
            title: server.name,
            users: users,
            server: server,
            droplet: response.data.droplet
          });
        })
        .catch(error => {
          console.log(error);
        });
    });
  });
};
