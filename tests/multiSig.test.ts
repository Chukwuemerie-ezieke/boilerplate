import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import {
    MethodCallOptions,
    PubKey,
    PubKeyHash,
    toHex,
    bsv,
    FixedArray,
    getDummySig,
    slice,
    findSigs,
} from 'scrypt-ts'
import { MultiSigPayment } from '../src/contracts/multiSig'
import { getDefaultSigner } from './utils/helper'

use(chaiAsPromised)

const privateKeys: bsv.PrivateKey[] = []
const publicKeys: bsv.PublicKey[] = []
const addresses: bsv.Address[] = []

for (let i = 0; i < 3; i++) {
    privateKeys.push(bsv.PrivateKey.fromRandom(bsv.Networks.testnet))
    publicKeys.push(privateKeys[i].publicKey)
    addresses.push(privateKeys[i].publicKey.toAddress())
}

describe('Test SmartContract `P2MS`', () => {
    before(async () => {
        await MultiSigPayment.compile()
    })

    it('should pass if using right private keys', async () => {
        const multiSigPayment = new MultiSigPayment(
            addresses.map((addr) => {
                return PubKeyHash(slice(addr.toHex(), 1n)) // Ignore address prefix.
            }) as FixedArray<PubKeyHash, 3>
        )

        // Dummy signer can take an array of signing private keys.
        await multiSigPayment.connect(getDefaultSigner(privateKeys))

        await multiSigPayment.deploy(1)

        const callContract = async () =>
            multiSigPayment.methods.unlock(
                // Filter out relevant signatures.
                // Be vary of the order (https://scrypt.io/docs/how-to-write-a-contract/built-ins#checkmultisig).
                (sigResps) => findSigs(sigResps, publicKeys),
                publicKeys.map((publicKey) => PubKey(toHex(publicKey))),
                // Method call options:
                {
                    pubKeyOrAddrToSign: publicKeys,
                } as MethodCallOptions<MultiSigPayment>
            )

        return expect(callContract()).not.rejected
    })

    it('should not pass if using wrong sig', async () => {
        const multiSigPayment = new MultiSigPayment(
            addresses.map((addr) => {
                return PubKeyHash(toHex(addr.toHex()))
            }) as FixedArray<PubKeyHash, 3>
        )

        await multiSigPayment.connect(getDefaultSigner(privateKeys))

        await multiSigPayment.deploy(1)
        const callContract = async () =>
            multiSigPayment.methods.unlock(
                (sigResps) => {
                    const res = findSigs(sigResps, publicKeys)
                    res[0] = getDummySig()
                    return res
                },
                publicKeys.map((publicKey) => PubKey(toHex(publicKey))),
                {
                    pubKeyOrAddrToSign: publicKeys,
                } as MethodCallOptions<MultiSigPayment>
            )

        return expect(callContract()).to.be.rejectedWith(/Execution failed/)
    })
})
