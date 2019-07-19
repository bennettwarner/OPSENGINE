const axios = require("axios");
const api = axios.create({ baseURL: "https://api.digitalocean.com/v2/" });
api_key = process.env.DO_APIKEY;
var config = {
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + api_key
  }
};

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

exports.deleteServer = (req, res, next) => {
  api
    .delete("droplets/" + "151513285", config)
    .then(response => {
      console.log(response.data);
      res.send(response.data);
    })
    .catch(error => {
      console.log(error);
    });
};
