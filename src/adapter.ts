import { Helper, Model, FilteredAdapter } from 'casbin'
import * as redis from 'redis'
import { promisify } from 'util'

interface IConnectionOptions {
    host: string
    port: number
}

class Line {
    p_type: string = ''
    v0: string = ''
    v1: string = ''
    v2: string = ''
    v3: string = ''
    v4: string = ''
    v5: string = ''
}

export class NodeRedisAdapter implements FilteredAdapter {

    private readonly redisInstance 
    private policies: any
    private filtered = false
    public isFiltered(): boolean {
        return this.filtered
    }
    private deliveredOptions = {
        retry_strategy(options: any) {
            if (options.error && options.error.code === 'ECONNREFUSED') {
                return new Error('The server refused the connection.')
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
                return new Error('Retry time exhausted')
            }
            if (options.attempt > 10) {
                return undefined
            }

            // reconnect after
            return Math.min(options.attempt * 100, 300)
        }
    }


    //Helper Methods

    savePolicyLine(ptype: any, rule: any) {
        const line = new Line()
        line.p_type = ptype
        if (rule.length > 0) {
            line.v0 = rule[0]
        }
        if (rule.length > 1) {
            line.v1 = rule[1]
        }
        if (rule.length > 2) {
            line.v2 = rule[2]
        }
        if (rule.length > 3) {
            line.v3 = rule[3]
        }
        if (rule.length > 4) {
            line.v4 = rule[4]
        }
        if (rule.length > 5) {
            line.v5 = rule[5]
        }
        return line
    }

    loadPolicyLine(line: any, model: any) {
        console.log("Load policies line called")
        let lineText = line.p_type
        if (line.v0) {
            lineText += ", " + line.v0
        }
        if (line.v1) {
            lineText += ", " + line.v1
        }
        if (line.v2) {
            lineText += ", " + line.v2
        }
        if (line.v3) {
            lineText += ", " + line.v3
        }
        if (line.v4) {
            lineText += ", " + line.v4
        }
        if (line.v5) {
            lineText += ", " + line.v5
        }
        Helper.loadPolicyLine(lineText, model)
    }

    storePolicies(policies: object) {
        return new Promise((resolve, reject) => {
            console.log({ r: this.redisInstance })
            this.redisInstance.del('policies')
            this.redisInstance.set('policies', JSON.stringify(policies), (err: any, reply: any) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(reply)
                }
            })
        })
    }

    reducePolicies(policies: any, p_type: string, rule: any) {
        let i = rule.length
        let policyIndex = policies.fieldIndex((policy: any) => {
            let flag = false
            flag = policy.p_type === p_type ? true : false
            flag = i > 5 && policy.v5 === rule[5] ? true : false
            flag = i > 4 && policy.v5 === rule[4] ? true : false
            flag = i > 3 && policy.v5 === rule[3] ? true : false
            flag = i > 2 && policy.v5 === rule[2] ? true : false
            flag = i > 1 && policy.v5 === rule[1] ? true : false
            return flag
        })
        if (policyIndex !== -1) {
            return policies.splice(policyIndex, 1)
        }
        return []
    }


    constructor(options: IConnectionOptions) {
        this.redisInstance = redis.createClient(
            {
                ...options,
                ...this.deliveredOptions
            }
        )
    }


    static async newAdapter(options: IConnectionOptions) {
        const adapter = new NodeRedisAdapter(options)
        await new Promise(resolve => adapter.redisInstance.on('connect', resolve))
        return adapter
    }

    // Adapter Methods
    
    public async loadPolicy(model: any) {
        this.redisInstance.get("policies", (err, policies: any) => {
            console.log("Policies: \n", policies)
            if (!err) {
                policies = JSON.parse(policies)
                this.policies = policies // for adding and removing policies methods
                console.log(policies)
                policies.forEach((policy: any, index: any) => {
                    this.loadPolicyLine(policy, model)
                })
            } else {
                return err
            }
        })
    }

    public async loadFilteredPolicy(model: Model, filter: object): Promise<void> {
        let key = filter['haskey']
        return await new Promise((resolve, reject) => {
            this.redisInstance.hgetall(key, (err, policies) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(err)
                    var AdapterRef = this
                    console.log("Policies : ", policies)
                    policies = JSON.parse(policies)
                    this.policies = policies
                    console.log(policies)
                    policies.forEach((policy, index) => {
                        AdapterRef.loadPolicyLine(policy, model)
                    })
                    console.log("Filtered Policies are loaded")
                    this.filtered = true
                }
            })
        })
    }

    public async savePolicy(model: Model): Promise<boolean> {

        const policyRuleAST = model.model.get("p")
        const groupingPolicyAST = model.model.get("g")
        let policies = []

        for (const [p_type, ast] of Object.entries(policyRuleAST)) {
            for (const rule of ast.policy) {
                const line = this.savePolicyLine(p_type, rule)
                policies.push(line)
            }
        }
    

        return new Promise((resolve, reject) => {
            console.log({r: this.redisInstance})
            this.redisInstance.del('policies')
            this.redisInstance.set('policies', JSON.stringify(policies), (err, reply) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(true)
                }
            })
        })
    }

    async addPolicy(sec, p_type, rule) {
        const line = this.savePolicyLine(p_type, rule)
        this.policies.push(line)
        this.storePolicies(this.policies)
        // resave the policies
    }

    async removePolicy(sec: any, p_type: any, rule: any) {
        let result = this.reducePolicies(this.policies, p_type, rule)
        // modified policies
        if (result.length) {
            this.policies = result
            // store in redis
            this.storePolicies(this.policies)
        } else {
            throw new Error("No policy error")
        }
    }

    public async removeFilteredPolicy(sec: string, p_type: string, fieldIndex: number, ...fieldValues: string[]) {
        throw new Error("Method not implemented")
    }
}
