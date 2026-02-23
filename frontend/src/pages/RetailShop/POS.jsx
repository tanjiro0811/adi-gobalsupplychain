import { useState } from 'react'
import BlockchainBadge from '../../components/blockchain/BlockchainBadge'

function POS({ products = [] }) {
  const [cart, setCart] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  const mockProducts = [
    { id: 'N95-001', name: 'N95 Mask Box (50pcs)', price: 45.99, stock: 120, verified: true },
    { id: 'IV-002', name: 'IV Set Standard', price: 12.50, stock: 34, verified: true },
    { id: 'CARE-003', name: 'Home Care Kit', price: 89.99, stock: 12, verified: false },
    { id: 'GLOVE-004', name: 'Nitrile Gloves (100pcs)', price: 24.99, stock: 78, verified: true },
    { id: 'THERM-005', name: 'Digital Thermometer', price: 15.99, stock: 45, verified: true },
  ]

  const displayProducts = products.length > 0 ? products : mockProducts

  const addToCart = (product) => {
    const existingItem = cart.find((item) => item.id === product.id)
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      )
    } else {
      setCart([...cart, { ...product, quantity: 1 }])
    }
  }

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.id !== productId))
  }

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
    } else {
      setCart(
        cart.map((item) =>
          item.id === productId ? { ...item, quantity: newQuantity } : item
        )
      )
    }
  }

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
  }

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Cart is empty!')
      return
    }
    alert(`Checkout completed!\nTotal: $${calculateTotal()}\nPayment: ${paymentMethod}`)
    setCart([])
  }

  const filteredProducts = displayProducts.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="pos-container">
      <div className="pos-grid">
        {/* Product Catalog */}
        <div className="card pos-catalog">
          <h4 className="card-title">Product Catalog</h4>
          <input
            type="text"
            className="search-input"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <div key={product.id} className="product-card">
                <div className="product-info">
                  <h5 className="product-name">{product.name}</h5>
                  <p className="product-id">SKU: {product.id}</p>
                  <p className="product-stock">Stock: {product.stock}</p>
                  <div className="product-footer">
                    <span className="product-price">${product.price}</span>
                    {product.verified && <BlockchainBadge label="✓" />}
                  </div>
                </div>
                <button
                  className="btn-add-cart"
                  onClick={() => addToCart(product)}
                  disabled={product.stock === 0}
                >
                  {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Shopping Cart */}
        <div className="card pos-cart">
          <h4 className="card-title">Shopping Cart ({cart.length})</h4>
          {cart.length === 0 ? (
            <div className="empty-cart">
              <p>Cart is empty</p>
              <p className="empty-cart-hint">Add products to get started</p>
            </div>
          ) : (
            <>
              <div className="cart-items">
                {cart.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className="cart-item-info">
                      <h5 className="cart-item-name">{item.name}</h5>
                      <p className="cart-item-price">${item.price}</p>
                    </div>
                    <div className="cart-item-controls">
                      <button
                        className="btn-quantity"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        -
                      </button>
                      <span className="cart-quantity">{item.quantity}</span>
                      <button
                        className="btn-quantity"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        className="btn-remove"
                        onClick={() => removeFromCart(item.id)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="cart-item-total">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="cart-summary">
                <div className="payment-method">
                  <label>Payment Method:</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="payment-select"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="wallet">Wallet</option>
                  </select>
                </div>
                <div className="cart-total">
                  <span className="total-label">Total:</span>
                  <span className="total-amount">${calculateTotal()}</span>
                </div>
                <button className="btn-checkout" onClick={handleCheckout}>
                  Complete Purchase
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default POS