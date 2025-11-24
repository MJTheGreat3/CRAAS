from sqlalchemy import Column, Integer, String, Float
from geoalchemy2 import Geometry
from ..database import Base

class HydroLine(Base):
    __tablename__ = "hydro_lines"
    
    id = Column(Integer, primary_key=True, index=True)
    source = Column(Integer, index=True)
    target = Column(Integer, index=True)
    length_m = Column(Float)
    geom = Column(Geometry('LINESTRING', srid=4326))
    
    def __repr__(self):
        return f"<HydroLine(id={self.id}, source={self.source}, target={self.target})>"
