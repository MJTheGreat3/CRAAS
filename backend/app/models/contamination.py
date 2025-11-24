from sqlalchemy import Column, Integer, String, DateTime, JSON, Text
from geoalchemy2 import Geometry
from ..database import Base
from datetime import datetime

class ContaminationEvent(Base):
    __tablename__ = "contamination_history"
    
    id = Column(Integer, primary_key=True, index=True)
    contamination_point = Column(Geometry('POINT', srid=4326), nullable=False)
    contamination_time = Column(DateTime, default=datetime.utcnow)
    contaminant_type = Column(String(100), nullable=False)
    severity_level = Column(String(20), default='medium')
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    analysis_results = Column(JSON)  # Store analysis results
    
    def __repr__(self):
        return f"<ContaminationEvent(id={self.id}, contamination_time={self.contamination_time})>"
