-- Filename: migrations/20240620_add_customer_history.sql
-- Description: Add customer history tracking for deleted items

-- Start transaction
BEGIN;

-- Create customer history table
CREATE TABLE IF NOT EXISTS customer_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID,
    customer_name TEXT NOT NULL,
    mobile_no TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pin_code TEXT,
    deleted_items JSONB DEFAULT '[]'::jsonb,
    total_deleted_items INTEGER DEFAULT 0,
    total_deleted_value NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    
    -- Add foreign key constraint to prescriptions table
    CONSTRAINT fk_customer_history_prescription
      FOREIGN KEY (customer_id) 
      REFERENCES prescriptions(id) 
      ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_history_customer_id ON customer_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_history_mobile_no ON customer_history(mobile_no);
CREATE INDEX IF NOT EXISTS idx_customer_history_created_at ON customer_history(created_at);
CREATE INDEX IF NOT EXISTS idx_customer_history_name ON customer_history(customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_history_email ON customer_history(email);

-- Create GIN index for JSONB queries on deleted_items
CREATE INDEX IF NOT EXISTS idx_customer_history_deleted_items 
  ON customer_history USING GIN (deleted_items);

-- Add comments for documentation
COMMENT ON TABLE customer_history IS 'Tracks customer history including deleted items for audit and recovery purposes';
COMMENT ON COLUMN customer_history.deleted_items IS 'Array of deleted items in JSON format with item details and deletion metadata';
COMMENT ON COLUMN customer_history.total_deleted_items IS 'Total count of deleted items for quick analytics';
COMMENT ON COLUMN customer_history.total_deleted_value IS 'Total monetary value of deleted items for quick analytics';

-- Create helper function for JSONB array appending
CREATE OR REPLACE FUNCTION jsonb_append(jsonb_col JSONB, new_value JSONB)
RETURNS JSONB AS $$
BEGIN
  RETURN COALESCE(jsonb_col, '[]'::jsonb) || new_value;
END;
$$ LANGUAGE plpgsql;

-- Create function to update customer history when items are deleted
CREATE OR REPLACE FUNCTION track_deleted_item()
RETURNS TRIGGER AS $$
DECLARE
    customer_record RECORD;
    order_record RECORD;
    deleted_item JSONB;
    user_id TEXT;
BEGIN
    -- Get user ID (you can modify this based on your auth system)
    user_id := 'system'; -- Default value
    
    -- Get order details
    SELECT o.*, p.name as customer_name, p.mobile_no, p.email, p.address, p.city, p.state, p.pin_code
    INTO order_record
    FROM orders o
    LEFT JOIN prescriptions p ON o.prescription_id = p.id
    WHERE o.id = OLD.order_id;
    
    IF order_record IS NULL THEN
        RETURN OLD;
    END IF;
    
    -- Prepare deleted item data
    deleted_item := jsonb_build_object(
        'id', OLD.id,
        'order_id', OLD.order_id,
        'item_code', OLD.item_code,
        'item_name', OLD.item_name,
        'item_type', OLD.item_type,
        'rate', OLD.rate,
        'qty', OLD.qty,
        'amount', OLD.amount,
        'tax_percent', OLD.tax_percent,
        'discount_percent', OLD.discount_percent,
        'discount_amount', OLD.discount_amount,
        'brand_name', OLD.brand_name,
        'index', OLD.index,
        'coating', OLD.coating,
        'deleted_at', NOW(),
        'deleted_by', user_id,
        'order_no', (SELECT order_no FROM orders WHERE id = OLD.order_id LIMIT 1),
        'prescription_no', (SELECT p.prescription_no 
                          FROM orders o 
                          JOIN prescriptions p ON o.prescription_id = p.id 
                          WHERE o.id = OLD.order_id 
                          LIMIT 1),
        'original_data', to_jsonb(OLD)
    );
    
    -- For backward compatibility
    deleted_item := jsonb_set(
        deleted_item,
        '{product_id}',
        to_jsonb(OLD.item_code)
    );
    
    deleted_item := jsonb_set(
        deleted_item,
        '{product_name}',
        to_jsonb(OLD.item_name)
    );
    
    deleted_item := jsonb_set(
        deleted_item,
        '{product_type}',
        to_jsonb(OLD.item_type)
    );
    
    deleted_item := jsonb_set(
        deleted_item,
        '{price}',
        to_jsonb(OLD.rate)
    );
    
    deleted_item := jsonb_set(
        deleted_item,
        '{quantity}',
        to_jsonb(OLD.qty)
    );
    
    -- Check if customer history exists
    SELECT * INTO customer_record
    FROM customer_history
    WHERE customer_id = order_record.prescription_id
    LIMIT 1;
    
    IF customer_record IS NOT NULL THEN
        -- Update existing history
        UPDATE customer_history
        SET 
            deleted_items = jsonb_append(deleted_items, deleted_item),
            total_deleted_items = total_deleted_items + 1,
            total_deleted_value = total_deleted_value + (COALESCE(OLD.amount, 0)),
            updated_at = NOW()
        WHERE id = customer_record.id;
    ELSE
        -- Create new history record
        INSERT INTO customer_history (
            customer_id,
            customer_name,
            mobile_no,
            email,
            address,
            city,
            state,
            pin_code,
            deleted_items,
            total_deleted_items,
            total_deleted_value
        ) VALUES (
            order_record.prescription_id,
            order_record.customer_name,
            order_record.mobile_no,
            order_record.email,
            order_record.address,
            order_record.city,
            order_record.state,
            order_record.pin_code,
            jsonb_build_array(deleted_item),
            1,
            COALESCE(OLD.amount, 0)
        );
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on order_items table
DROP TRIGGER IF EXISTS trg_order_items_delete ON order_items;
CREATE TRIGGER trg_order_items_delete
    BEFORE DELETE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION track_deleted_item();

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_customer_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
DROP TRIGGER IF EXISTS trg_customer_history_updated_at ON customer_history;
CREATE TRIGGER trg_customer_history_updated_at
    BEFORE UPDATE ON customer_history
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_history_updated_at();

-- Commit the transaction
COMMIT;