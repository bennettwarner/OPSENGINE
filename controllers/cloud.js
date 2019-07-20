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

//////////////////////////////////////////////////////////////

exports.getImages = (req, res, next) => {
  api
    .get("images?private=true", config)
    .then(response => {
      all_images = response.data.images;
      images = [];
      for (x in all_images) {
        if (all_images[x].type == "snapshot") {
          images.push(all_images[x]);
          console.log(all_images[x]);
        }
      }
      res.send(images);
    })
    .catch(error => {
      console.log(error);
    });
};

exports.getServers = (req, res, next) => {
  api
    .get("droplets?tag_name=" + process.env.DO_SERVERTAG, config)
    .then(response => {
      console.log(response.data);
      res.send(response.data);
    })
    .catch(error => {
      console.log(error);
    });
};

exports.createServer = (req, res, next) => {
  api
    .post(
      "droplets",
      {
        name: String(new Date().getTime()),
        region: "nyc1",
        size: "s-1vcpu-2gb",
        image: 49784231,
        backups: false,
        ipv6: false,
        user_data: `#!/bin/bash
		sudo echo -e "linuxpassword\nlinuxpassword" | passwd root`,
        private_networking: null,
        volumes: null,
        tags: [process.env.DO_SERVERTAG]
      },
      config
    )
    .then(response => {
      console.log(response.data);
      res.send(response.data);
    })
    .catch(error => {
      console.log(error);
    });
};

//////////////////////////////////////////////////////////////

exports.getInfrastructure = (req, res, next) => {
  api
    .get("droplets?tag_name=" + process.env.DO_SERVERTAG, config)
    .then(response => {
      console.log(response.data.droplets);
      res.render("infrastructure/infrastructure", {
        title: "Infrastructure",
        infrastructure: response.data.droplets
      });
    })
    .catch(error => {
      console.log(error);
    });
};

exports.getdeployInfrastructure = (req, res, next) => {
  api
    .get("images?private=true", config)
    .then(response => {
      all_images = response.data.images;
      images = [];
      for (x in all_images) {
        if (all_images[x].type == "snapshot") {
          images.push(all_images[x]);
          console.log(all_images[x]);
        }
      }
      res.render("infrastructure/create", {
        title: "Deploy Infrastructure",
        images: images
      });
    })
    .catch(error => {
      console.log(error);
    });
};

exports.postdeployInfrastructure = (req, res, next) => {
  var password =
    "align" +
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
            console.log(response2.data.droplet);
            res.render("infrastructure/createSuccess", {
              title: "Deploy Infrastructure",
              name: name,
              password: password,
              ip: response2.data.droplet.networks.v4
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
      console.log(response.data);
      res.redirect("/infrastructure");
    })
    .catch(error => {
      console.log(error);
    });
};
