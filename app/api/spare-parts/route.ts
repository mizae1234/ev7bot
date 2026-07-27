import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

// GET: Fetch all active spare parts
export async function GET() {
  try {
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const result = await pool.request().query(`
      SELECT PartID, SKU, PartName, ProductNumberReference, SearchName, IsActive, CreatedAt, UpdatedAt
      FROM dbo.GI_SparePart
      WHERE IsActive = 1
      ORDER BY PartName ASC, SKU ASC
    `)

    return NextResponse.json({ parts: result.recordset })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Get Spare Parts Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: Create or import spare parts
export async function POST(request: NextRequest) {
  try {
    const { parts } = await request.json()
    // parts should be an array of { SKU, PartName }
    
    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json({ error: 'No parts data provided' }, { status: 400 })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    
    let inserted = 0
    let skipped = 0

    try {
      for (const part of parts) {
        if (!part.SKU || !part.PartName) continue

        // Check if SKU exists
        const checkResult = await transaction.request()
          .input('sku', sql.NVarChar, part.SKU)
          .query(`SELECT PartID FROM dbo.GI_SparePart WHERE SKU = @sku`)
        
        if (checkResult.recordset.length > 0) {
          skipped++
          continue
        }

        // Insert new part
        await transaction.request()
          .input('sku', sql.NVarChar, part.SKU)
          .input('partName', sql.NVarChar, part.PartName)
          .input('productNumberReference', sql.NVarChar, part.ProductNumberReference || null)
          .input('searchName', sql.NVarChar, part.SearchName || null)
          .query(`
            INSERT INTO dbo.GI_SparePart (SKU, PartName, ProductNumberReference, SearchName, IsActive, CreatedAt, UpdatedAt)
            VALUES (@sku, @partName, @productNumberReference, @searchName, 1, GETDATE(), GETDATE())
          `)
        inserted++
      }
      
      await transaction.commit()
      return NextResponse.json({ success: true, inserted, skipped })
    } catch (err) {
      await transaction.rollback()
      throw err
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Import Spare Parts Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
