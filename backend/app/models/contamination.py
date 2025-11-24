from sqlalchemy import Column, Integer, String, DateTime, JSON
from geoalchemy2 import Geometry
from ..database import Base
from datetime import datetime

class ContaminationEvent(Base):
    __tablename__ = "contamination_history"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    params_json = Column(JSON)  # Store analysis parameters
    geom = Column(Geometry('POINT', srid=4326))
    
    def __repr__(self):
        return f"<ContaminationEvent(id={self.id}, timestamp={self.timestamp})>"
