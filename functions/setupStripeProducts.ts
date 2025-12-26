import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        const products = [
            {
                name: 'RevisionGrade Basic',
                price: 2000, // $20 in cents
                description: '50 evaluations per month, 100K word limit, Quick Scene/Chapter Eval',
                planKey: 'basic'
            },
            {
                name: 'RevisionGrade Pro',
                price: 5000, // $50 in cents
                description: 'Unlimited evaluations, 500K word limit, Full Manuscript Spine Evaluation',
                planKey: 'pro'
            },
            {
                name: 'RevisionGrade Enterprise',
                price: 20000, // $200 in cents
                description: 'Unlimited everything, white-glove service, dedicated account manager',
                planKey: 'enterprise'
            }
        ];

        const results = [];

        for (const prod of products) {
            // Create product
            const product = await stripe.products.create({
                name: prod.name,
                description: prod.description,
                metadata: {
                    plan_key: prod.planKey
                }
            });

            // Create recurring price
            const price = await stripe.prices.create({
                product: product.id,
                unit_amount: prod.price,
                currency: 'usd',
                recurring: {
                    interval: 'month'
                },
                metadata: {
                    plan_key: prod.planKey
                }
            });

            results.push({
                product_id: product.id,
                price_id: price.id,
                name: prod.name,
                plan_key: prod.planKey
            });
        }

        return Response.json({ success: true, products: results });
    } catch (error) {
        console.error('Setup error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});