import { expect } from 'chai'
import { OrderedSigStateful } from '../src/contracts/orderedSigStateful'
import { getDefaultSigner } from './utils/helper'
import {
    ContractTransaction,
    FixedArray,
    MethodCallOptions,
    PubKey,
    Utils,
    bsv,
    findSig,
    hash160,
    toByteString,
} from 'scrypt-ts'
import { myAddress, myPublicKey } from './utils/privateKey'

const N_SIGNERS = OrderedSigStateful.N_SIGNERS

describe('Test SmartContract `OrderedSigStateful`', () => {
    const destAddr = hash160(myPublicKey.toHex())

    const privKeys: bsv.PrivateKey[] = []
    const pubKeys: bsv.PublicKey[] = []
    let signers: FixedArray<PubKey, typeof N_SIGNERS>

    const msg = toByteString('Hello, sCrypt!', true)

    before(async () => {
        const _signers: Array<PubKey> = []
        for (let i = 0; i < N_SIGNERS; i++) {
            const privKey = bsv.PrivateKey.fromRandom(bsv.Networks.testnet)
            const pubKey = new bsv.PublicKey(privKey.publicKey.point)
            privKeys.push(privKey)
            pubKeys.push(pubKey)
            _signers.push(PubKey(pubKey.toHex()))
        }
        signers = _signers as FixedArray<PubKey, typeof N_SIGNERS>

        await OrderedSigStateful.compile()
    })

    it('should pass w correct sigs', async () => {
        const orderedSig = new OrderedSigStateful(msg, signers, destAddr)
        await orderedSig.connect(getDefaultSigner(privKeys))

        await orderedSig.deploy(1)

        let currentInstance = orderedSig

        for (let i = 0; i < N_SIGNERS; i++) {
            // Create the next instance from the current.
            const nextInstance = currentInstance.next()

            // Apply updates on the next instance off chain.
            nextInstance.currentSignerIdx += 1n

            // If last signer, next output needs to pay destination
            // address with a P2PKH output.
            // To achieve that, we override the tx builder for the "unlock"
            // method.
            if (i == N_SIGNERS - 1) {
                currentInstance.bindTxBuilder(
                    'unlock',
                    (
                        current: OrderedSigStateful,
                        options: MethodCallOptions<OrderedSigStateful>,
                        ...args: any
                    ): Promise<ContractTransaction> => {
                        const tx = new bsv.Transaction()
                            // add contract input
                            .addInput(current.buildContractInput())
                            // add a p2pkh output
                            .addOutput(
                                new bsv.Transaction.Output({
                                    script: bsv.Script.fromHex(
                                        Utils.buildPublicKeyHashScript(
                                            current.dest
                                        )
                                    ),
                                    satoshis: current.balance,
                                })
                            )
                        if (options.changeAddress) {
                            // add change output
                            tx.change(options.changeAddress)
                        }

                        const result = {
                            tx: tx,
                            atInputIndex: 0, // the contract input's index
                            nexts: [],
                        }

                        return Promise.resolve(result)
                    }
                )
            }

            // Call the unlock method.
            const callContract = async () =>
                await currentInstance.methods.unlock(
                    (sigResps) => findSig(sigResps, pubKeys[i]),
                    {
                        next: {
                            instance: nextInstance,
                            balance: currentInstance.balance,
                        },
                        pubKeyOrAddrToSign: pubKeys[i],
                        changeAddress: myAddress,
                    } as MethodCallOptions<OrderedSigStateful>
                )
            await expect(callContract()).not.rejected

            // Update the current instance reference.
            currentInstance = nextInstance
        }
    })
})
