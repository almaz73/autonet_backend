import {dealers} from '../db.js'

export async function getDealers(req, res) {
    try {
        const rows = await dealers.findAll({
            attributes: ['id', 'city', 'url', 'coords', 'address', 'tel', 'days', 'profile', 'brands', 'link'],
            order: [['id', 'ASC']],
            raw: true,
        })
        res.json(rows)
    } catch (error) {
        console.error('Error getting dealers:', error)
        res.status(500).json({error: 'Failed to get dealers'})
    }
}
