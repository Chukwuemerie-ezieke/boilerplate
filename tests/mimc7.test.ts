import { expect } from 'chai'
import { Mimc7Test } from '../src/contracts/mimc7'
import { getDefaultSigner } from './utils/helper'

describe('Test SmartContract `Mimc7Test`', () => {
    before(async () => {
        await Mimc7Test.compile()
    })

    it('should pass the public method unit test successfully.', async () => {
        const mimc7 = new Mimc7Test()
        await mimc7.connect(getDefaultSigner())

        const deployTx = await mimc7.deploy(1)
        console.log('Mimc7Test contract deployed: ', deployTx.id)

        const { tx: callTx, atInputIndex } = await mimc7.methods.unlock(
            1n,
            2n,
            10594780656576967754230020536574539122676596303354946869887184401991294982664n
        )
        console.log('Mimc7Test contract called: ', callTx.id)

        const result = callTx.verifyScript(atInputIndex)
        expect(result.success, result.error).to.eq(true)
    })
})