import { expect, use } from 'chai'
import { CrossChainSwap } from '../src/contracts/crossChainSwap'
import { getDefaultSigner } from './utils/helper'
import {
    MethodCallOptions,
    PubKey,
    bsv,
    findSig,
    sha256,
    toByteString,
} from 'scrypt-ts'
import chaiAsPromised from 'chai-as-promised'

use(chaiAsPromised)

describe('Test SmartContract `CrossChainSwap`', () => {
    let crossChainSwap: CrossChainSwap
    const lockTimeMin = 1673510000n

    const alicePrivKey = bsv.PrivateKey.fromRandom(bsv.Networks.testnet)
    const alicePubKey = alicePrivKey.publicKey

    const bobPrivKey = bsv.PrivateKey.fromRandom(bsv.Networks.testnet)
    const bobPubKey = bobPrivKey.publicKey

    const x = toByteString(
        'f00cfd8df5f92d5e94d1ecbd9b427afd14e03f8a3292ca4128cd59ef7b9643bc'
    )
    const xHash = sha256(x)

    before(async () => {
        await CrossChainSwap.compile()

        crossChainSwap = new CrossChainSwap(
            PubKey(alicePubKey.toHex()),
            PubKey(bobPubKey.toHex()),
            xHash,
            lockTimeMin
        )
    })

    it('should pass unlock', async () => {
        await crossChainSwap.connect(getDefaultSigner(alicePrivKey))

        await crossChainSwap.deploy(1)
        const callContract = async () =>
            crossChainSwap.methods.unlock(
                x,
                (sigResps) => findSig(sigResps, alicePubKey),
                {
                    pubKeyOrAddrToSign: alicePubKey,
                } as MethodCallOptions<CrossChainSwap>
            )
        return expect(callContract()).not.rejected
    })

    it('should pass cancel', async () => {
        await crossChainSwap.connect(getDefaultSigner(bobPrivKey))

        await crossChainSwap.deploy(1)
        const callContract = async () =>
            crossChainSwap.methods.cancel(
                (sigResps) => findSig(sigResps, bobPubKey),
                {
                    lockTime: 1673523720,
                    pubKeyOrAddrToSign: bobPubKey,
                } as MethodCallOptions<CrossChainSwap>
            )
        return expect(callContract()).not.rejected
    })

    it('should fail withdraw when nLocktime is too low.', async () => {
        await crossChainSwap.connect(getDefaultSigner(bobPrivKey))

        await crossChainSwap.deploy(1)
        const callContract = async () =>
            crossChainSwap.methods.cancel(
                (sigResps) => findSig(sigResps, bobPubKey),
                {
                    lockTime: 1673500100,
                    pubKeyOrAddrToSign: bobPubKey,
                } as MethodCallOptions<CrossChainSwap>
            )
        return expect(callContract()).to.be.rejectedWith(
            /locktime has not yet expired/
        )
    })
})
