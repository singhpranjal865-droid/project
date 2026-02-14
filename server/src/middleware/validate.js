const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
    // Schema can validate body, query, params
    // Combine them if needed, or check individually
    const objectToValidate = {};
    if (schema.body) objectToValidate.body = req.body;
    if (schema.query) objectToValidate.query = req.query;
    if (schema.params) objectToValidate.params = req.params;

    const { error } = Joi.object(schema).unknown(true).validate({
        body: req.body,
        query: req.query,
        params: req.params
    }, { abortEarly: false });

    if (error) {
        const errorMessage = error.details.map((details) => details.message).join(', ');
        return res.status(400).json({ error: errorMessage });
    }

    Object.assign(req, value);
    return next();
};

const schemas = {
    // Components
    componentCreate: {
        body: Joi.object({
            name: Joi.string().required().min(3).max(100),
            part_number: Joi.string().required().alphanum().min(3).max(50),
            working_stock: Joi.number().integer().min(0).default(0),
            scrap_stock: Joi.number().integer().min(0).default(0),
            monthly_requirement: Joi.number().integer().min(0).default(0)
        })
    },
    componentUpdate: {
        body: Joi.object({
            name: Joi.string().min(3).max(100),
            part_number: Joi.string().alphanum().min(3).max(50),
            working_stock: Joi.number().integer().min(0),
            scrap_stock: Joi.number().integer().min(0),
            monthly_requirement: Joi.number().integer().min(0)
        }).min(1)
    },
    componentScrap: {
        params: Joi.object({
            id: Joi.number().integer().required()
        }),
        body: Joi.object({
            quantity: Joi.number().integer().min(1).required(),
            reason: Joi.string().allow('').max(255)
        })
    },

    // Procurement
    restock: {
        body: Joi.object({
            component_id: Joi.number().integer().required(),
            quantity: Joi.number().integer().min(1).required()
        })
    },

    // PCBs
    pcbCreate: {
        body: Joi.object({
            name: Joi.string().required().min(3).max(100),
            preorder_type: Joi.string().valid('daily', 'weekly', 'monthly').allow(null, ''),
            preorder_quantity: Joi.number().integer().min(0).default(0),
            components: Joi.array().items(
                Joi.object({
                    id: Joi.number().integer(),                  // For existing component
                    name: Joi.string().when('id', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }), // For new
                    part_number: Joi.string().when('id', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
                    quantity_per_pcb: Joi.number().integer().min(1).required()
                })
            ).default([])
        })
    },
    pcbBuild: {
        params: Joi.object({
            id: Joi.number().integer().required()
        }),
        body: Joi.object({
            quantity: Joi.number().integer().min(1).default(1)
        })
    },

    // Pagination Query
    pagination: {
        query: Joi.object({
            page: Joi.number().integer().min(1).default(1),
            limit: Joi.number().integer().min(1).max(100).default(50)
        })
    }
};

module.exports = { validate, schemas };
