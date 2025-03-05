const crypto = require('crypto');

// Encode keys in Base64 (WireGuard format)
function encodeBase64(buffer) {
    return buffer.toString('base64');
}

// Generate a WireGuard private & public key pair (X25519)
function generateKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519');
    return {
        privateKey: encodeBase64(privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32)), // Last 32 bytes = raw private key
        publicKey: encodeBase64(publicKey.export({ type: 'spki', format: 'der' }).slice(-32)) // Last 32 bytes = raw public key
    };
}

// Generate a preshared key (32 random bytes)
function generatePresharedKey() {
    return encodeBase64(crypto.randomBytes(32));
}

module.exports = async ({ api: createApi }) => {

    return {
        name: "wg <device-id>",
        description: "creates and registers wireguard client - needed for manual installation only",
        define(program) {
        },
        async run(deviceId) {

            let {portal} = await createApi();

            const { privateKey, publicKey } = generateKeyPair();
            const presharedKey = generatePresharedKey();

            let wireGuardSettings = await portal.getWireGuardSettings({ deviceId });

            await portal.setWireGuardKeys({
                deviceId,
                publicKey: publicKey,
                presharedKey: presharedKey
            });

            process.stdout.write(`DEVICE_WG_PRIVATE_KEY=${privateKey}
DEVICE_WG_PRESHARED_KEY=${presharedKey}
DEVICE_WG_ADDR=${wireGuardSettings.address}
DEVICE_WG_MASK=${wireGuardSettings.cidr}
SERVER_WG_PUBLIC_KEY=${wireGuardSettings.server.publicKey}
SERVER_WG_HOST=${wireGuardSettings.server.host}
SERVER_WG_PORT=${wireGuardSettings.server.port}
`);
        }
    }
}