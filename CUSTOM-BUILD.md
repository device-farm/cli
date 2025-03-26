To install DEVICE.FARM on already running system, you need to:

Create "custom build" device in device.farm

On your workstation run `defa wg <device-id>`.
The output is a configuration file you need to save on your device as `/etc/df-wireguard` .

Set config file access rights: `chmod 600 /etc/df-wireguard` .

Save `/usr/bin/df-wireguard-start` with:
```sh
#!/bin/sh

set -e

source /etc/df-wireguard

umask 77
echo $DEVICE_WG_PRIVATE_KEY >/tmp/df-key
echo $DEVICE_WG_PRESHARED_KEY >/tmp/df-psk

ip address add dev wg0 $DEVICE_WG_ADDR/$DEVICE_WG_MASK

sysctl -w net.ipv4.conf.wg0.route_localnet=1
iptables -t nat -A PREROUTING -d $DEVICE_WG_ADDR -j DNAT --to-destination 127.0.0.7

WG_ENDPOINT_RESOLUTION_RETRIES=infinity wg set wg0 private-key /tmp/df-key \
        peer $SERVER_WG_PUBLIC_KEY \
        preshared-key /tmp/df-psk \
        endpoint $SERVER_WG_HOST:$SERVER_WG_PORT \
        persistent-keepalive 5 \
        allowed-ips 0.0.0.0/0 &
```

Set permissions: `chmod 770 /usr/bin/df-wireguard-start`

Save `/usr/bin/df-wireguard-stop` with:
```sh
#!/bin/sh

set -e

source /etc/df-wireguard

iptables -t nat -D PREROUTING -d $DEVICE_WG_ADDR -j DNAT --to-destination 127.0.0.7
ip link del dev wg0
```

Set permissions: `chmod 770 /usr/bin/df-wireguard-stop`

Add to `/etc/network/interfaces`:
```
auto wg0
iface wg0 inet manual
  pre-up ip link add dev wg0 type wireguard || true
  up ip link set up dev wg0
  post-up df-wireguard-start
  post-down df-wireguard-stop
```

Reboot the device.

Check Wireguard: `wg show`

Install docker:
```sh
apt add docker
rc-update add docker default
mkdir /etc/docker
```

Save `/etc/docker/daemon.json` with:
```
{
"log-driver": "json-file",
"log-opts": {
    "max-size": "10m",
    "max-file": "3"
    }
}
```

Save `/etc/conf.d/docker` with:
```
DOCKER_OPTS="-H unix:///var/run/docker.sock -H tcp://127.0.0.7:2375"
```

Add `--data-root` option if you want to save container data on non-default location.

Start docker: `service docker start`
