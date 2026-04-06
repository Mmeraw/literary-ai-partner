import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get("Stripe_CREATION_KEY"), {
    apiVersion: '2024-12-18.acacia'
});

Deno.serve(async (req) => {
    try {
        // Get all prices with their products
        const prices = await stripe.prices.list({
            active: true,
            expand: ['data.product']
        });

        const priceMap = {};
        
        for (const price of prices.data) {
            if (price.metadata?.plan_key) {
                priceMap[price.metadata.plan_key] = {
                    price_id: price.id,
                    product_id: price.product.id,
                    amount: price.unit_amount / 100,
                    currency: price.currency
                };
            }
        }

        return Response.json({ prices: priceMap });
    } catch (error) {
        console.error('Error fetching prices:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});