# Contamination Risk Analysis & Alert System (CRAS)

A web-based application that identifies communities and facilities at risk when
contamination is detected in waterway networks.

## System Architecture

### Backend (FastAPI)

- **Technology**: Python 3.9+, FastAPI, SQLAlchemy, PostGIS
- **Database**: PostgreSQL with PostGIS and pgRouting extensions
- **Features**:
  - RESTful API for contamination analysis
  - Geospatial analysis using pgRouting
  - Real-time risk assessment
  - Analysis history tracking

### Frontend (React)

- **Technology**: React 18, Leaflet, Ant Design
- **Features**:
  - Interactive map with hydrology network visualization
  - Click-to-add contamination points
  - Real-time risk analysis
  - Results table with filtering and sorting
  - Export to Excel/CSV functionality

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 16+
- PostgreSQL 14+ with PostGIS 3+ and pgRouting

### Backend Setup

1. Navigate to backend directory:

```bash
cd backend
```

2. Create virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Configure environment variables:

```bash
cp .env.example .env
# Edit .env with your database connection details
```

5. Start the backend server:

```bash
python main.py
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

The application will be available at `http://localhost:3000`

## API Documentation

Once the backend is running, visit `http://localhost:8000/docs` for interactive
API documentation.

### Key Endpoints

- `POST /api/v1/contamination/analyze` - Run contamination analysis
- `GET /api/v1/hydrology/network` - Get hydrology network data
- `GET /api/v1/endpoints/` - Get endpoints (hospitals, schools, etc.)
- `GET /api/v1/contamination/history` - Get analysis history

## Database Schema

The system expects the following tables in your PostgreSQL database:

### hydro_lines

```sql
CREATE TABLE hydro_lines (
    id INTEGER PRIMARY KEY,
    source INTEGER,
    target INTEGER,
    length_m FLOAT,
    geom GEOMETRY(LINESTRING, 4326)
);
```

### endpoints

```sql
CREATE TABLE endpoints (
    endpoint_id VARCHAR PRIMARY KEY,
    endpoint_type VARCHAR,
    intake_id VARCHAR,
    geom GEOMETRY(POINT, 4326)
);
```

### contamination_history

```sql
CREATE TABLE contamination_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP,
    params_json JSONB,
    geom GEOMETRY(POINT, 4326)
);
```

## Usage

1. **Load the Application**: Open the web application at `http://localhost:3000`
2. **Add Contamination Point**: Click anywhere on the map to add a contamination
   point
3. **Configure Analysis**: Set contaminant type, dispersion rate, and time
   window
4. **Run Analysis**: Click "Run Analysis" to identify at-risk facilities
5. **View Results**: See risk levels, arrival times, and affected endpoints
6. **Export Results**: Download detailed reports in Excel format

## Risk Levels

- **High Risk** (Red): Contamination arrival < 6 hours
- **Moderate Risk** (Orange): Contamination arrival 6-24 hours
- **Low Risk** (Yellow): Contamination arrival > 24 hours

## Features

### Interactive Map

- Display hydrology network (rivers & channels)
- Show endpoints (hospitals, schools, farmlands, residential areas)
- Click to add contamination points
- Real-time visualization of analysis results

### Analysis Engine

- pgRouting-based network analysis
- Time-based contamination spread modeling
- Configurable dispersion rates
- Multi-endpoint risk assessment

### Results & Reporting

- Sortable and filterable results table
- Risk level categorization
- Export to Excel with multiple sheets
- Emergency contact information
- Analysis performance metrics

## Configuration

### Environment Variables (.env)

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/cras_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cras_db
DB_USER=username
DB_PASSWORD=password

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True

# Security
SECRET_KEY=your-secret-key-here
API_KEY=your-api-key-here
```

## Development

### Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Code Style

- Backend: Follows PEP 8
- Frontend: ESLint + Prettier configuration

## Deployment

### Docker Deployment (Coming Soon)

```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Production Considerations

- Use HTTPS in production
- Configure proper database connection pooling
- Set up monitoring and logging
- Implement user authentication
- Configure CORS for production domains

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify PostgreSQL is running
   - Check connection string in .env
   - Ensure PostGIS and pgRouting extensions are installed

2. **Map Not Loading**
   - Check browser console for errors
   - Verify backend API is accessible
   - Ensure CORS is properly configured

3. **Analysis Fails**
   - Check if hydrology network data exists
   - Verify pgRouting topology is created
   - Check database logs for SQL errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for
details.

## Support

For support and questions:

- Create an issue in the repository
- Check the API documentation at `/docs`
- Review the troubleshooting section above
