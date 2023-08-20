export type Order = {op: string, shape: number[]}

export function parseOrder(src: string): Order[] {
    return src.split("\n").filter(s => s != "").map(line => {
        let data = line.split(":")
        let op = data[0].trim()
        let dims = data[1] == "scalar" ? [] : data[1].split(" ").map(n => +n)
        let order: Order = {
            op: op,
            shape: dims
        }
        return order
    })
}