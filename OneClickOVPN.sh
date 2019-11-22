if [[ ! -e /dev/net/tun ]]; then
	echo "The TUN device is not available
You need to enable TUN before running this script"
	exit
fi

if ! iptables -t nat -nL &>/dev/null; then
	echo "Unable to initialize the iptables/netfilter NAT table, setup can't continue.
If you are a LowEndSpirit customer, see here: https://git.io/nfLES
If you are getting this message on any other provider, ask them for support."
	exit
fi

if [[ -e /etc/debian_version ]]; then
	os="debian"
	group_name="nogroup"
else
	echo "Looks like you aren't running this installer on Debian, Ubuntu or CentOS"
	exit
fi

new_client () {
	# Generates the custom client.ovpn
	{
	cat /etc/openvpn/server/client-common.txt
	echo "<ca>"
	cat /etc/openvpn/server/easy-rsa/pki/ca.crt
	echo "</ca>"
	echo "<cert>"
	sed -ne '/BEGIN CERTIFICATE/,$ p' /etc/openvpn/server/easy-rsa/pki/issued/"$1".crt
	echo "</cert>"
	echo "<key>"
	cat /etc/openvpn/server/easy-rsa/pki/private/"$1".key
	echo "</key>"
	echo "<tls-crypt>"
	sed -ne '/BEGIN OpenVPN Static key/,$ p' /etc/openvpn/server/tc.key
	echo "</tls-crypt>"
	} > ~/"$1".ovpn
}

if [[ $(ip addr | grep inet | grep -v inet6 | grep -vEc '127\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}') -eq 1 ]]; then
	ip=$(ip addr | grep inet | grep -v inet6 | grep -vE '127\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' | cut -d '/' -f 1 | grep -oE '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}')
else
	number_of_ips=$(ip addr | grep inet | grep -v inet6 | grep -vEc '127\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}')
	echo
	echo "What IPv4 address should the OpenVPN server bind to?"
	ip addr | grep inet | grep -v inet6 | grep -vE '127\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' | cut -d '/' -f 1 | grep -oE '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' | nl -s ') '
	ip_number=1
	[[ -z "$ip_number" ]] && ip_number="1"
	ip=$(ip addr | grep inet | grep -v inet6 | grep -vE '127\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' | cut -d '/' -f 1 | grep -oE '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' | sed -n "$ip_number"p)
fi
protocol=1
until [[ -z "$protocol" || "$protocol" =~ ^[12]$ ]]; do
	echo "$protocol: invalid selection."
	read -p "Protocol [1]: " protocol
done
case "$protocol" in
	1|"") 
	protocol=udp
	;;
	2) 
	protocol=tcp
	;;
esac
echo
echo "What port do you want OpenVPN listening to?"
port=1194
until [[ -z "$port" || "$port" =~ ^[0-9]+$ && "$port" -le 65535 ]]; do
	echo "$port: invalid selection."
	read -p "Port [1194]: " port
done
[[ -z "$port" ]] && port="1194"
echo
echo "Which DNS do you want to use with the VPN?"
echo "   1) Current system resolvers"
echo "   2) 1.1.1.1"
echo "   3) Google"
echo "   4) OpenDNS"
echo "   5) Verisign"
dns=3
until [[ -z "$dns" || "$dns" =~ ^[1-5]$ ]]; do
	echo "$dns: invalid selection."
	read -p "DNS [1]: " dns
done
echo
echo "Finally, tell me a name for the client certificate."
unsanitized_client="client"
# Allow a limited set of characters to avoid conflicts
client=$(sed 's/[^0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-]/_/g' <<< "$unsanitized_client")
[[ -z "$client" ]] && client="client"
echo
echo "Okay, that was all I needed. We are ready to set up your OpenVPN server now."
# If running inside a container, disable LimitNPROC to prevent conflicts
if systemd-detect-virt -cq; then
	mkdir /etc/systemd/system/openvpn-server@server.service.d/ 2>/dev/null
	echo "[Service]
LimitNPROC=infinity" > /etc/systemd/system/openvpn-server@server.service.d/disable-limitnproc.conf
fi
if [[ "$os" = "debian" ]]; then
	apt-get update
	apt-get install openvpn iptables openssl ca-certificates -y
else
	# Else, the distro is CentOS
	yum install epel-release -y
	yum install openvpn iptables openssl ca-certificates -y
fi
# Get easy-rsa
easy_rsa_url='https://github.com/OpenVPN/easy-rsa/releases/download/v3.0.5/EasyRSA-nix-3.0.5.tgz'
wget -O ~/easyrsa.tgz "$easy_rsa_url" 2>/dev/null || curl -Lo ~/easyrsa.tgz "$easy_rsa_url"
tar xzf ~/easyrsa.tgz -C ~/
mv ~/EasyRSA-3.0.5/ /etc/openvpn/server/
mv /etc/openvpn/server/EasyRSA-3.0.5/ /etc/openvpn/server/easy-rsa/
chown -R root:root /etc/openvpn/server/easy-rsa/
rm -f ~/easyrsa.tgz
cd /etc/openvpn/server/easy-rsa/
# Create the PKI, set up the CA and the server and client certificates
./easyrsa init-pki
./easyrsa --batch build-ca nopass
EASYRSA_CERT_EXPIRE=3650 ./easyrsa build-server-full server nopass
EASYRSA_CERT_EXPIRE=3650 ./easyrsa build-client-full "$client" nopass
EASYRSA_CRL_DAYS=3650 ./easyrsa gen-crl
# Move the stuff we need
cp pki/ca.crt pki/private/ca.key pki/issued/server.crt pki/private/server.key pki/crl.pem /etc/openvpn/server
# CRL is read with each client connection, when OpenVPN is dropped to nobody
chown nobody:"$group_name" /etc/openvpn/server/crl.pem
# Generate key for tls-crypt
openvpn --genkey --secret /etc/openvpn/server/tc.key
# Create the DH parameters file using the predefined ffdhe2048 group
echo '-----BEGIN DH PARAMETERS-----
MIIBCAKCAQEA//////////+t+FRYortKmq/cViAnPTzx2LnFg84tNpWp4TZBFGQz
+8yTnc4kmz75fS/jY2MMddj2gbICrsRhetPfHtXV/WVhJDP1H18GbtCFY2VVPe0a
87VXE15/V8k1mE8McODmi3fipona8+/och3xWKE2rec1MKzKT0g6eXq8CrGCsyT7
YdEIqUuyyOP7uWrat2DX9GgdT0Kj3jlN9K5W7edjcrsZCwenyO4KbXCeAvzhzffi
7MA0BM0oNC9hkXL+nOmFg/+OTxIy7vKBg8P+OxtMb61zO7X8vC7CIAXFjvGDfRaD
ssbzSibBsu/6iGtCOGEoXJf//////////wIBAg==
-----END DH PARAMETERS-----' > /etc/openvpn/server/dh.pem
# Generate server.conf
echo "local $ip
port $port
proto $protocol
dev tun
ca ca.crt
cert server.crt
key server.key
dh dh.pem
auth SHA512
tls-crypt tc.key
topology subnet
server 10.8.0.0 255.255.255.0
ifconfig-pool-persist ipp.txt" > /etc/openvpn/server/server.conf
echo 'push "redirect-gateway def1 bypass-dhcp"' >> /etc/openvpn/server/server.conf
# DNS
case "$dns" in
	1|"")
	# Locate the proper resolv.conf
	# Needed for systems running systemd-resolved
	if grep -q "127.0.0.53" "/etc/resolv.conf"; then
		resolv_conf="/run/systemd/resolve/resolv.conf"
	else
		resolv_conf="/etc/resolv.conf"
	fi
	# Obtain the resolvers from resolv.conf and use them for OpenVPN
	grep -v '#' "$resolv_conf" | grep nameserver | grep -E -o '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' | while read line; do
		echo "push \"dhcp-option DNS $line\"" >> /etc/openvpn/server/server.conf
	done
	;;
	2)
	echo 'push "dhcp-option DNS 1.1.1.1"' >> /etc/openvpn/server/server.conf
	echo 'push "dhcp-option DNS 1.0.0.1"' >> /etc/openvpn/server/server.conf
	;;
	3)
	echo 'push "dhcp-option DNS 8.8.8.8"' >> /etc/openvpn/server/server.conf
	echo 'push "dhcp-option DNS 8.8.4.4"' >> /etc/openvpn/server/server.conf
	;;
	4)
	echo 'push "dhcp-option DNS 208.67.222.222"' >> /etc/openvpn/server/server.conf
	echo 'push "dhcp-option DNS 208.67.220.220"' >> /etc/openvpn/server/server.conf
	;;
	5)
	echo 'push "dhcp-option DNS 64.6.64.6"' >> /etc/openvpn/server/server.conf
	echo 'push "dhcp-option DNS 64.6.65.6"' >> /etc/openvpn/server/server.conf
	;;
esac
echo "keepalive 10 120
cipher AES-256-CBC
user nobody
group $group_name
persist-key
persist-tun
status openvpn-status.log
verb 3
crl-verify crl.pem" >> /etc/openvpn/server/server.conf
if [[ "$protocol" = "udp" ]]; then
	echo "explicit-exit-notify" >> /etc/openvpn/server/server.conf
fi
# Enable net.ipv4.ip_forward for the system
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/30-openvpn-forward.conf
# Enable without waiting for a reboot or service restart
echo 1 > /proc/sys/net/ipv4/ip_forward
if pgrep firewalld; then
	# Using both permanent and not permanent rules to avoid a firewalld
	# reload.
	# We don't use --add-service=openvpn because that would only work with
	# the default port and protocol.
	firewall-cmd --add-port="$port"/"$protocol"
	firewall-cmd --zone=trusted --add-source=10.8.0.0/24
	firewall-cmd --permanent --add-port="$port"/"$protocol"
	firewall-cmd --permanent --zone=trusted --add-source=10.8.0.0/24
	# Set NAT for the VPN subnet
	firewall-cmd --direct --add-rule ipv4 nat POSTROUTING 0 -s 10.8.0.0/24 ! -d 10.8.0.0/24 -j SNAT --to "$ip"
	firewall-cmd --permanent --direct --add-rule ipv4 nat POSTROUTING 0 -s 10.8.0.0/24 ! -d 10.8.0.0/24 -j SNAT --to "$ip"
else
	# Create a service to set up persistent iptables rules
	echo "[Unit]
Before=network.target
[Service]
Type=oneshot
ExecStart=/sbin/iptables -t nat -A POSTROUTING -s 10.8.0.0/24 ! -d 10.8.0.0/24 -j SNAT --to $ip
ExecStart=/sbin/iptables -I INPUT -p $protocol --dport $port -j ACCEPT
ExecStart=/sbin/iptables -I FORWARD -s 10.8.0.0/24 -j ACCEPT
ExecStart=/sbin/iptables -I FORWARD -m state --state RELATED,ESTABLISHED -j ACCEPT
ExecStop=/sbin/iptables -t nat -D POSTROUTING -s 10.8.0.0/24 ! -d 10.8.0.0/24 -j SNAT --to $ip
ExecStop=/sbin/iptables -D INPUT -p $protocol --dport $port -j ACCEPT
ExecStop=/sbin/iptables -D FORWARD -s 10.8.0.0/24 -j ACCEPT
ExecStop=/sbin/iptables -D FORWARD -m state --state RELATED,ESTABLISHED -j ACCEPT
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target" > /etc/systemd/system/openvpn-iptables.service
	systemctl enable --now openvpn-iptables.service
fi
# If SELinux is enabled and a custom port was selected, we need this
if sestatus 2>/dev/null | grep "Current mode" | grep -q "enforcing" && [[ "$port" != 1194 ]]; then
	# Install semanage if not already present
	if ! hash semanage 2>/dev/null; then
		if grep -qs "CentOS Linux release 7" "/etc/centos-release"; then
			yum install policycoreutils-python -y
		else
			yum install policycoreutils-python-utils -y
		fi
	fi
	semanage port -a -t openvpn_port_t -p "$protocol" "$port"
fi
# If the server is behind a NAT, use the correct IP address
if [[ "$public_ip" != "" ]]; then
	ip="$public_ip"
fi
# client-common.txt is created so we have a template to add further users later
echo "client
dev tun
proto $protocol
remote $ip $port
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
auth SHA512
cipher AES-256-CBC
ignore-unknown-option block-outside-dns
block-outside-dns
verb 3" > /etc/openvpn/server/client-common.txt
# Enable and start the OpenVPN service
systemctl enable --now openvpn-server@server.service
# Generates the custom client.ovpn
new_client "$client"
echo
echo "Finished!"
echo
echo "Your client configuration is available at:" ~/"$client.ovpn"
echo "If you want to add more clients, just run this script again!"